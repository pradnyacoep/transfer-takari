// Utilities for handling attachments in comments and follow-up notes (PDF, Word, PPT, Excel, Images, etc.)
import { CommentAttachment } from '../types';
import { uid } from './helpers';

// Open IndexedDB database for persistent attachment storage
const DB_NAME = 'tw_task_attachments_db';
const STORE_NAME = 'attachments';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      resolve(null);
      return;
    }
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => {
        console.warn('IndexedDB open error for attachments:', e);
        resolve(null);
      };
    } catch (e) {
      console.warn('IndexedDB failed to initialize:', e);
      resolve(null);
    }
  });
}

// Store attachment binary data URL persistently in IndexedDB
export async function saveAttachmentToIDB(id: string, dataUrl: string): Promise<void> {
  const db = await openDB();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put({ id, dataUrl, savedAt: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

// Retrieve attachment binary data URL from IndexedDB
export async function getAttachmentFromIDB(id: string): Promise<string | null> {
  const db = await openDB();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => {
        if (req.result && req.result.dataUrl) {
          resolve(req.result.dataUrl);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

// Format byte sizes cleanly: e.g. 350 B, 45.2 KB, 1.8 MB
export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  if (i === 0) return `${bytes} B`;
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export type FileCategoryType = 'pdf' | 'word' | 'ppt' | 'excel' | 'image' | 'text' | 'file';

export interface FileCategoryInfo {
  category: FileCategoryType;
  label: string;
  color: string;
  bg: string;
  border: string;
}

// Categorize file by name or MIME type for badges and preview logic
export function getFileCategory(fileName: string, mimeType?: string): FileCategoryInfo {
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  const mime = (mimeType || '').toLowerCase();

  // PDF
  if (ext === 'pdf' || mime.includes('pdf')) {
    return {
      category: 'pdf',
      label: 'PDF',
      color: '#B91C1C',
      bg: '#FEF2F2',
      border: '#FCA5A5',
    };
  }

  // Word (doc, docx)
  if (ext === 'doc' || ext === 'docx' || mime.includes('word') || mime.includes('document')) {
    return {
      category: 'word',
      label: 'DOC',
      color: '#1D4ED8',
      bg: '#EFF6FF',
      border: '#93C5FD',
    };
  }

  // PowerPoint (ppt, pptx)
  if (ext === 'ppt' || ext === 'pptx' || mime.includes('presentation') || mime.includes('powerpoint')) {
    return {
      category: 'ppt',
      label: 'PPT',
      color: '#C2410C',
      bg: '#FFF7ED',
      border: '#FDBA74',
    };
  }

  // Excel / CSV / Spreadsheets
  if (ext === 'xls' || ext === 'xlsx' || ext === 'csv' || mime.includes('sheet') || mime.includes('excel')) {
    return {
      category: 'excel',
      label: 'XLS',
      color: '#15803D',
      bg: '#F0FDF4',
      border: '#86EFAC',
    };
  }

  // Images
  if (
    ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext) ||
    mime.startsWith('image/')
  ) {
    return {
      category: 'image',
      label: 'IMG',
      color: '#7E22CE',
      bg: '#FAF5FF',
      border: '#D8B4FE',
    };
  }

  // Text
  if (['txt', 'rtf', 'md', 'log'].includes(ext) || mime.startsWith('text/')) {
    return {
      category: 'text',
      label: 'TXT',
      color: '#0F766E',
      bg: '#F0FDFA',
      border: '#99F6E4',
    };
  }

  // Default general file
  return {
    category: 'file',
    label: ext ? ext.toUpperCase().slice(0, 4) : 'FILE',
    color: '#475569',
    bg: '#F8FAFC',
    border: '#CBD5E1',
  };
}

// Convert a File object to a CommentAttachment and persist in IndexedDB
export async function fileToAttachment(file: File): Promise<CommentAttachment> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });

  const id = uid('att');
  // Persist to IndexedDB for large document resilience
  await saveAttachmentToIDB(id, dataUrl);

  return {
    id,
    name: file.name,
    size: file.size,
    type: file.type || getFileCategory(file.name).category,
    uploadedAt: new Date().toISOString(),
    dataUrl,
  };
}

// Helper to trigger browser download for an attachment
export async function downloadAttachment(attachment: CommentAttachment): Promise<void> {
  let url = attachment.dataUrl;
  if (!url) {
    url = (await getAttachmentFromIDB(attachment.id)) || undefined;
  }

  if (!url) {
    alert('Attachment data could not be retrieved.');
    return;
  }

  const a = document.createElement('a');
  a.href = url;
  a.download = attachment.name || 'attachment';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
