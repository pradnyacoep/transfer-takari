import React, { useState } from 'react';
import {
  Paperclip,
  Download,
  Eye,
  X,
  FileText,
  FileSpreadsheet,
  Presentation,
  Image as ImageIcon,
  File as FileIcon,
  ExternalLink,
} from 'lucide-react';
import { CommentAttachment } from '../types';
import {
  formatFileSize,
  getFileCategory,
  downloadAttachment,
  FileCategoryType,
} from '../utils/attachmentStorage';

// Icon selector based on file category
export function getCategoryIcon(category: FileCategoryType, size = 14) {
  switch (category) {
    case 'pdf':
      return <FileText size={size} />;
    case 'word':
      return <FileText size={size} />;
    case 'ppt':
      return <Presentation size={size} />;
    case 'excel':
      return <FileSpreadsheet size={size} />;
    case 'image':
      return <ImageIcon size={size} />;
    default:
      return <FileIcon size={size} />;
  }
}

// Single attachment chip/pill
export function AttachmentPill({
  attachment,
  onPreview,
  onRemove,
  compact = false,
}: {
  key?: React.Key;
  attachment: CommentAttachment;
  onPreview?: (att: CommentAttachment) => void;
  onRemove?: (att: CommentAttachment) => void;
  compact?: boolean;
}) {
  const cat = getFileCategory(attachment.name, attachment.type);

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: compact ? '2px 6px' : '4px 8px',
        borderRadius: 6,
        background: '#F8FAFC',
        border: '1px solid #E2E8F0',
        fontSize: compact ? 11 : 12,
        maxWidth: compact ? 220 : 320,
        overflow: 'hidden',
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
      }}
      title={`${attachment.name} (${formatFileSize(attachment.size)})`}
    >
      {/* Category badge */}
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 3,
          fontSize: 9.5,
          fontWeight: 700,
          padding: '1px 5px',
          borderRadius: 4,
          background: cat.bg,
          color: cat.color,
          border: `1px solid ${cat.border}`,
          flexShrink: 0,
        }}
      >
        {getCategoryIcon(cat.category, 11)}
        <span>{cat.label}</span>
      </span>

      {/* File name */}
      <span
        style={{
          color: 'var(--tw-ink)',
          fontWeight: 500,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
        }}
      >
        {attachment.name}
      </span>

      {/* File size */}
      <span
        style={{
          color: 'var(--tw-ink-soft)',
          fontSize: 10,
          flexShrink: 0,
        }}
      >
        {formatFileSize(attachment.size)}
      </span>

      {/* Actions */}
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
        {onPreview && (
          <button
            type="button"
            className="tw-iconbtn"
            style={{ padding: 2, color: 'var(--tw-ink-soft)' }}
            onClick={(e) => {
              e.stopPropagation();
              onPreview(attachment);
            }}
            title={`Preview ${attachment.name}`}
          >
            <Eye size={12} />
          </button>
        )}

        <button
          type="button"
          className="tw-iconbtn"
          style={{ padding: 2, color: 'var(--tw-ink-soft)' }}
          onClick={(e) => {
            e.stopPropagation();
            downloadAttachment(attachment);
          }}
          title={`Download ${attachment.name}`}
        >
          <Download size={12} />
        </button>

        {onRemove && (
          <button
            type="button"
            className="tw-iconbtn"
            style={{ padding: 2, color: '#B91C1C' }}
            onClick={(e) => {
              e.stopPropagation();
              onRemove(attachment);
            }}
            title="Remove attachment"
          >
            <X size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

// List of attachments inside a comment
export function CommentAttachmentList({
  attachments,
  onRemove,
}: {
  attachments?: CommentAttachment[];
  onRemove?: (att: CommentAttachment) => void;
}) {
  const [previewAttachment, setPreviewAttachment] = useState<CommentAttachment | null>(null);

  if (!attachments || attachments.length === 0) return null;

  return (
    <>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          marginTop: 6,
          paddingTop: 6,
          borderTop: '1px dashed var(--tw-line)',
        }}
      >
        {attachments.map((att) => (
          <AttachmentPill
            key={att.id}
            attachment={att}
            onPreview={(a) => setPreviewAttachment(a)}
            onRemove={onRemove}
          />
        ))}
      </div>

      {previewAttachment && (
        <AttachmentPreviewModal
          attachment={previewAttachment}
          onClose={() => setPreviewAttachment(null)}
        />
      )}
    </>
  );
}

// Rich preview modal for viewing PDF, Images, or document details
export function AttachmentPreviewModal({
  attachment,
  onClose,
}: {
  attachment: CommentAttachment;
  onClose: () => void;
}) {
  const cat = getFileCategory(attachment.name, attachment.type);
  const isImage = cat.category === 'image';
  const isPdf = cat.category === 'pdf';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(2px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        className="tw-card"
        style={{
          width: '100%',
          maxWidth: isPdf ? 900 : isImage ? 800 : 540,
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          padding: 0,
          background: '#FFFFFF',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '12px 18px',
            borderBottom: '1px solid var(--tw-line)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#F8FAFC',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 11,
                fontWeight: 700,
                padding: '2px 7px',
                borderRadius: 4,
                background: cat.bg,
                color: cat.color,
                border: `1px solid ${cat.border}`,
                flexShrink: 0,
              }}
            >
              {getCategoryIcon(cat.category, 13)}
              <span>{cat.label}</span>
            </span>

            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: 13.5,
                  color: 'var(--tw-ink)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={attachment.name}
              >
                {attachment.name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--tw-ink-soft)' }}>
                {formatFileSize(attachment.size)} &bull; Attached in follow-up notes
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <button
              type="button"
              className="tw-btn tw-btn-primary"
              style={{ padding: '5px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}
              onClick={() => downloadAttachment(attachment)}
            >
              <Download size={13} />
              <span>Download</span>
            </button>

            <button
              type="button"
              className="tw-iconbtn"
              style={{ padding: 6 }}
              onClick={onClose}
              title="Close preview"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div
          style={{
            padding: isPdf ? 0 : 20,
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: isPdf ? '#525659' : '#FAFAFA',
            minHeight: 280,
          }}
        >
          {isPdf ? (
            attachment.dataUrl ? (
              <iframe
                src={attachment.dataUrl}
                title={attachment.name}
                style={{ width: '100%', height: '70vh', border: 'none' }}
              />
            ) : (
              <div style={{ padding: 30, textAlign: 'center', color: '#FFFFFF' }}>
                <p>PDF loaded from offline store.</p>
                <button
                  type="button"
                  className="tw-btn tw-btn-primary"
                  onClick={() => downloadAttachment(attachment)}
                >
                  Download PDF
                </button>
              </div>
            )
          ) : isImage ? (
            <div style={{ textAlign: 'center', maxWidth: '100%' }}>
              <img
                src={attachment.dataUrl}
                alt={attachment.name}
                style={{
                  maxWidth: '100%',
                  maxHeight: '68vh',
                  objectFit: 'contain',
                  borderRadius: 6,
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                }}
              />
            </div>
          ) : (
            // Word, PPT, Excel or Other Document Info Card
            <div
              style={{
                maxWidth: 420,
                width: '100%',
                background: '#FFFFFF',
                borderRadius: 8,
                border: '1px solid var(--tw-line)',
                padding: 24,
                textAlign: 'center',
                boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
              }}
            >
              <div
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: 12,
                  background: cat.bg,
                  color: cat.color,
                  border: `1px solid ${cat.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 14px',
                }}
              >
                {getCategoryIcon(cat.category, 28)}
              </div>

              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--tw-ink)', marginBottom: 4 }}>
                {attachment.name}
              </div>

              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: cat.bg,
                  color: cat.color,
                  border: `1px solid ${cat.border}`,
                  fontSize: 11,
                  fontWeight: 600,
                  marginBottom: 12,
                }}
              >
                {cat.label} Document &bull; {formatFileSize(attachment.size)}
              </div>

              <p style={{ fontSize: 12.5, color: 'var(--tw-ink-soft)', lineHeight: 1.5, marginBottom: 18 }}>
                This file is stored in your task follow-up notes. You can download and open it directly in{' '}
                {cat.category === 'word'
                  ? 'Microsoft Word or Google Docs'
                  : cat.category === 'ppt'
                  ? 'PowerPoint or Google Slides'
                  : cat.category === 'excel'
                  ? 'Microsoft Excel or Google Sheets'
                  : 'its default application'}
                .
              </p>

              <button
                type="button"
                className="tw-btn tw-btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '9px 16px', fontSize: 13 }}
                onClick={() => downloadAttachment(attachment)}
              >
                <Download size={15} style={{ marginRight: 6 }} />
                Download and Open File
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
