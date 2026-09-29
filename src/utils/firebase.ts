import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  onSnapshot,
  writeBatch,
  getDocFromServer,
  getDocsFromServer,
  Unsubscribe,
} from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { Task, User, PersonalTask, OfficeContact } from '../types';

// Initialize Firebase App
export const app = initializeApp(firebaseConfig);

// Initialize Authentication
export const auth = getAuth(app);

// Initialize Cloud Firestore with dedicated databaseId
export const FIRESTORE_DATABASE_ID =
  (firebaseConfig as Record<string, any>).firestoreDatabaseId ||
  'ai-studio-divisiontaskregi-984a0ef1-1591-4f6f-a2a5-4e36cd070f92';

export const db = getFirestore(app, FIRESTORE_DATABASE_ID);

// Track active auth & sync state
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

let currentUserAuth: FirebaseUser | null = null;
let isAuthReady = false;

onAuthStateChanged(auth, (user) => {
  currentUserAuth = user;
  isAuthReady = true;
});

// Test cloud connection as per Firebase integration requirements
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore client is offline, using cache and local storage.');
    }
    return false;
  }
}

// Clean data to prevent Firestore "Function addDoc() called with invalid data. Unsupported field value: undefined" errors
export function sanitizeForFirestore<T>(data: T): T {
  return JSON.parse(
    JSON.stringify(data, (_, value) => (value === undefined ? null : value))
  );
}

export interface AppConfig {
  users: User[];
  units: string[];
  tags: string[];
  pendingOffices: string[];
  officeContacts?: Record<string, OfficeContact>;
  designations: string[];
  packages?: string[];
  updatedAt?: string;
}

// ----------------------------------------------------
// Office Tasks Real-Time Synchronization
// ----------------------------------------------------

/**
 * Subscribes to the live cloud Firestore 'tasks' collection.
 * Any update on PC, Tab, or Mobile immediately fires the callback.
 */
export function subscribeCloudTasks(
  onUpdate: (tasks: Task[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'tasks';
  const tasksCol = collection(db, path);
  return onSnapshot(
    tasksCol,
    (snapshot) => {
      const taskList: Task[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Task;
        taskList.push(data);
      });
      // Sort tasks by priority / creation date if desired, or stable ID
      taskList.sort((a, b) => {
        const timeA = new Date(a.createdAt || 0).getTime();
        const timeB = new Date(b.createdAt || 0).getTime();
        return timeB - timeA;
      });
      onUpdate(taskList);
    },
    (err) => {
      console.warn('Firestore tasks snapshot error:', err);
      if (err.code === 'permission-denied' || err.message?.includes('Missing or insufficient permissions')) {
        handleFirestoreError(err, OperationType.GET, path);
      }
      if (onError) onError(err);
    }
  );
}

/**
 * Direct one-shot fetch from Firestore server to guarantee instant sync
 */
export async function fetchTasksDirectFromCloud(): Promise<Task[]> {
  const path = 'tasks';
  try {
    const tasksCol = collection(db, path);
    const snapshot = await getDocs(tasksCol);
    const taskList: Task[] = [];
    snapshot.forEach((docSnap) => {
      taskList.push(docSnap.data() as Task);
    });
    taskList.sort((a, b) => {
      const timeA = new Date(a.createdAt || 0).getTime();
      const timeB = new Date(b.createdAt || 0).getTime();
      return timeB - timeA;
    });
    return taskList;
  } catch (err: any) {
    if (err?.code === 'permission-denied' || err?.message?.includes('Missing or insufficient permissions')) {
      handleFirestoreError(err, OperationType.LIST, path);
    }
    console.warn('Firestore direct fetch fallback notice:', err);
    throw err;
  }
}

/**
 * Saves or updates a single office task to Firestore
 */
export async function saveTaskToCloud(task: Task): Promise<void> {
  const path = `tasks/${task.id}`;
  try {
    const taskRef = doc(db, 'tasks', task.id);
    await setDoc(taskRef, sanitizeForFirestore(task), { merge: true });
  } catch (err: any) {
    if (err?.code === 'permission-denied' || err?.message?.includes('Missing or insufficient permissions')) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
    console.error('Failed to save task to cloud:', err);
    throw err;
  }
}

/**
 * Batch saves multiple tasks to Firestore with resilient lightweight chunking (50 tasks max per chunk)
 * and an automatic individual document fallback to prevent mobile/Wi-Fi timeouts from dropping writes.
 */
export async function saveTasksBatchToCloud(tasks: Task[]): Promise<void> {
  if (!tasks || tasks.length === 0) return;
  const CHUNK_SIZE = 50; // Lightweight 50-task chunking for resilient mobile & desktop sync

  for (let i = 0; i < tasks.length; i += CHUNK_SIZE) {
    const chunk = tasks.slice(i, i + CHUNK_SIZE);
    let batchSucceeded = false;

    try {
      const batch = writeBatch(db);
      for (const t of chunk) {
        const taskRef = doc(db, 'tasks', t.id);
        batch.set(taskRef, sanitizeForFirestore(t), { merge: true });
      }
      await batch.commit();
      batchSucceeded = true;
    } catch (batchErr: any) {
      console.warn(
        `Chunk ${Math.floor(i / CHUNK_SIZE) + 1} batch write interrupted, switching to individual document fallback...`,
        batchErr
      );
    }

    // Automatic individual fallback if batch failed or was interrupted
    if (!batchSucceeded) {
      console.log(`Writing ${chunk.length} tasks individually to guarantee persistence...`);
      for (const t of chunk) {
        try {
          const taskRef = doc(db, 'tasks', t.id);
          await setDoc(taskRef, sanitizeForFirestore(t), { merge: true });
        } catch (indivErr: any) {
          console.error(`Failed to write task ${t.id} individually:`, indivErr);
          if (indivErr?.code === 'permission-denied') {
            handleFirestoreError(indivErr, OperationType.WRITE, `tasks/${t.id}`);
          }
        }
      }
    }
  }
}

/**
 * Permanently deletes a task from Firestore
 */
export async function deleteTaskFromCloud(taskId: string): Promise<void> {
  const path = `tasks/${taskId}`;
  try {
    const taskRef = doc(db, 'tasks', taskId);
    await deleteDoc(taskRef);
  } catch (err: any) {
    if (err?.code === 'permission-denied' || err?.message?.includes('Missing or insufficient permissions')) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
    console.error('Failed to delete task from cloud:', err);
    throw err;
  }
}

// ----------------------------------------------------
// App Configuration Real-Time Synchronization (Users, Units, Tags, Offices, Designations)
// ----------------------------------------------------

export function subscribeCloudAppConfig(
  onUpdate: (config: AppConfig | null) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'meta/app_config';
  const configRef = doc(db, 'meta', 'app_config');
  return onSnapshot(
    configRef,
    (snap) => {
      if (snap.exists()) {
        onUpdate(snap.data() as AppConfig);
      } else {
        onUpdate(null);
      }
    },
    (err) => {
      console.warn('Firestore app config error:', err);
      if (err.code === 'permission-denied' || err.message?.includes('Missing or insufficient permissions')) {
        handleFirestoreError(err, OperationType.GET, path);
      }
      if (onError) onError(err);
    }
  );
}

export async function saveAppConfigToCloud(config: Partial<AppConfig>): Promise<void> {
  const path = 'meta/app_config';
  try {
    const configRef = doc(db, 'meta', 'app_config');
    await setDoc(
      configRef,
      sanitizeForFirestore({
        ...config,
        updatedAt: new Date().toISOString(),
      }),
      { merge: true }
    );
  } catch (err: any) {
    if (err?.code === 'permission-denied' || err?.message?.includes('Missing or insufficient permissions')) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
    console.error('Failed to save app config to cloud:', err);
  }
}

// ----------------------------------------------------
// Personal Tasks Real-Time Synchronization
// ----------------------------------------------------

export function subscribeCloudPersonalTasks(
  arg1: string | ((tasks: PersonalTask[]) => void),
  arg2?: ((tasks: PersonalTask[]) => void) | ((err: Error) => void),
  arg3?: (err: Error) => void
): Unsubscribe {
  let userId: string | null = null;
  let onUpdate: (tasks: PersonalTask[]) => void;
  let onError: ((err: Error) => void) | undefined;

  if (typeof arg1 === 'string') {
    userId = arg1;
    onUpdate = arg2 as (tasks: PersonalTask[]) => void;
    onError = arg3;
  } else {
    onUpdate = arg1;
    onError = arg2 as ((err: Error) => void) | undefined;
  }

  const path = 'personal_tasks';
  const colRef = collection(db, path);
  return onSnapshot(
    colRef,
    (snap) => {
      const list: PersonalTask[] = [];
      snap.forEach((d) => {
        const item = d.data() as PersonalTask;
        if (!userId || !item.createdBy || item.createdBy === userId) {
          list.push(item);
        }
      });
      list.sort((a, b) => {
        const timeA = new Date(a.createdAt || 0).getTime();
        const timeB = new Date(b.createdAt || 0).getTime();
        return timeB - timeA;
      });
      onUpdate(list);
    },
    (err) => {
      console.warn('Firestore personal tasks error:', err);
      if (err.code === 'permission-denied' || err.message?.includes('Missing or insufficient permissions')) {
        handleFirestoreError(err, OperationType.GET, path);
      }
      if (onError) onError(err);
    }
  );
}

export async function savePersonalTaskToCloud(task: PersonalTask): Promise<void> {
  const path = `personal_tasks/${task.id}`;
  try {
    const taskRef = doc(db, 'personal_tasks', task.id);
    await setDoc(taskRef, sanitizeForFirestore(task), { merge: true });
  } catch (err: any) {
    if (err?.code === 'permission-denied' || err?.message?.includes('Missing or insufficient permissions')) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
    console.error('Failed to save personal task to cloud:', err);
  }
}

export async function savePersonalTasksBatchToCloud(
  tasks: PersonalTask[],
  userId?: string
): Promise<void> {
  if (tasks.length === 0) return;
  const batch = writeBatch(db);
  for (const t of tasks) {
    const ref = doc(db, 'personal_tasks', t.id);
    const data = sanitizeForFirestore(userId ? { ...t, createdBy: t.createdBy || userId } : t);
    batch.set(ref, data, { merge: true });
  }
  try {
    await batch.commit();
  } catch (err: any) {
    if (err?.code === 'permission-denied' || err?.message?.includes('Missing or insufficient permissions')) {
      handleFirestoreError(err, OperationType.WRITE, 'personal_tasks');
    }
    throw err;
  }
}

export async function deletePersonalTaskFromCloud(taskId: string): Promise<void> {
  const path = `personal_tasks/${taskId}`;
  try {
    const taskRef = doc(db, 'personal_tasks', taskId);
    await deleteDoc(taskRef);
  } catch (err: any) {
    if (err?.code === 'permission-denied' || err?.message?.includes('Missing or insufficient permissions')) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
    console.error('Failed to delete personal task from cloud:', err);
  }
}

export function subscribeCloudPersonalMeta(
  userId: string,
  onUpdate: (meta: { contacts?: string[]; tags?: string[] } | null) => void
): Unsubscribe {
  if (!userId) return () => {};
  const path = `meta/personal_meta_${userId}`;
  const metaRef = doc(db, 'meta', `personal_meta_${userId}`);
  return onSnapshot(
    metaRef,
    (snap) => {
      if (snap.exists()) {
        onUpdate(snap.data() as { contacts?: string[]; tags?: string[] });
      } else {
        onUpdate(null);
      }
    },
    (err) => {
      console.warn('Personal meta subscription notice:', err);
      if (err.code === 'permission-denied' || err.message?.includes('Missing or insufficient permissions')) {
        handleFirestoreError(err, OperationType.GET, path);
      }
    }
  );
}

export async function savePersonalMetaToCloud(
  userId: string,
  meta: { contacts?: string[]; tags?: string[] }
): Promise<void> {
  if (!userId) return;
  const path = `meta/personal_meta_${userId}`;
  try {
    const metaRef = doc(db, 'meta', `personal_meta_${userId}`);
    await setDoc(metaRef, sanitizeForFirestore(meta), { merge: true });
  } catch (err: any) {
    if (err?.code === 'permission-denied' || err?.message?.includes('Missing or insufficient permissions')) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
    console.warn('Failed to save personal meta to cloud:', err);
  }
}
