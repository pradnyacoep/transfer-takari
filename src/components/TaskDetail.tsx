import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Pencil,
  Trash2,
  Bell,
  Clock,
  ClipboardList,
  Building2,
  Tag as TagIcon,
  MessageSquare,
  AlertTriangle,
  Paperclip,
  Upload,
  MessageCircle,
  Layers,
} from 'lucide-react';
import { Task, User, CommentAttachment } from '../types';
import {
  STATUS_LABEL,
  STATUS_COLOR,
  PRIORITY_COLOR,
  STATUSES,
} from '../constants';
import {
  fmtDate,
  fmtDateTime,
  fmtDeadline,
  todayISO,
  currentTimeHHMM,
  combineDateTime,
  isOverdue,
  isFollowUpDue,
  allowedNextStatuses,
  canEditTask,
  uid,
} from '../utils/helpers';
import {
  CollapsibleSection,
  InfoLine,
  DayQuickPicks,
  PendingAtPicker,
  MentionInput,
  TaskListModal,
} from './CommonPickers';
import { EditTaskModal } from './EditTaskModal';
import { fileToAttachment } from '../utils/attachmentStorage';
import { CommentAttachmentList, AttachmentPill } from './CommentAttachmentList';
import { getTaskPackage, getPackageBadgeColor } from '../utils/schemePackage';
import { calculatePendencyInfo } from '../utils/pendencyAging';
import { PendencyBadge } from './PendencyBadge';

export function TaskDetail({
  task,
  allTasks,
  currentUser,
  users,
  tags,
  addTagIfNew,
  pendingOffices,
  addPendingOfficeIfNew,
  packages = [],
  onClose,
  onOpenTask,
  onUpdate,
  onDelete,
  onOpenWhatsApp,
  flash,
}: {
  task: Task;
  allTasks: Task[];
  currentUser: User;
  users: User[];
  tags: string[];
  addTagIfNew?: (tag: string, currentTags: string[]) => Promise<string[] | void>;
  pendingOffices: string[];
  addPendingOfficeIfNew?: (office: string) => Promise<void>;
  packages?: string[];
  onClose: () => void;
  onOpenTask: (id: string) => void;
  onUpdate: (updated: Task) => Promise<void> | void;
  onDelete: () => Promise<void> | void;
  onOpenWhatsApp?: (task: Task, reminderType?: string) => void;
  flash: (msg: string) => void;
}) {
  const [commentText, setCommentText] = useState('');
  const [followUpDate, setFollowUpDate] = useState(todayISO());
  const [followUpTime, setFollowUpTime] = useState(currentTimeHHMM());
  const [nextMode, setNextMode] = useState<'date' | 'days'>('days');
  const [nextDate, setNextDate] = useState(task.nextFollowUpDate || todayISO());
  const [nextDays, setNextDays] = useState('');

  useEffect(() => {
    setNextMode('days');
    setNextDate(task.nextFollowUpDate || todayISO());
    setNextDays('');
  }, [task.id]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [stagedAttachments, setStagedAttachments] = useState<CommentAttachment[]>([]);
  const [isAttaching, setIsAttaching] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [targetAppendCommentId, setTargetAppendCommentId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const appendFileInputRef = useRef<HTMLInputElement>(null);
  const [assigneeView, setAssigneeView] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const assigneeList = (task.assigneeIds || [])
    .map((id) => users.find((u) => u.id === id))
    .filter(Boolean) as User[];

  const creator = users.find((u) => u.id === task.createdBy);
  const nextStatuses = allowedNextStatuses(currentUser, task);
  const editable = canEditTask(currentUser, task);
  const canTrack =
    editable || (task.assigneeIds || []).includes(currentUser.id);

  const assignedPkg = getTaskPackage(task);
  const pkgColor = assignedPkg ? getPackageBadgeColor(assignedPkg) : null;
  const pendencyInfo = calculatePendencyInfo(task);

  const assigneePendingTasks = assigneeView
    ? (allTasks || [])
        .filter(
          (t) =>
            (t.assigneeIds || []).includes(assigneeView.id) &&
            t.status !== 'COMPLETED' &&
            t.status !== 'ARCHIVED'
        )
        .sort((a, b) => {
          const av = a.nextFollowUpDate;
          const bv = b.nextFollowUpDate;
          if (!av && !bv) return 0;
          if (!av) return 1;
          if (!bv) return -1;
          return new Date(av).getTime() - new Date(bv).getTime();
        })
    : [];

  const changeStatus = (status: string) => {
    const updated: Task = {
      ...task,
      status,
      history: [
        ...task.history,
        { status, at: new Date().toISOString(), by: currentUser.id },
      ],
    };
    onUpdate(updated);
    flash(`Status moved to ${STATUS_LABEL[status] || status}.`);
  };

  const handleFilesChosen = async (files: FileList | File[] | null) => {
    if (!files || files.length === 0) return;
    setIsAttaching(true);
    try {
      const parsed: CommentAttachment[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const att = await fileToAttachment(file);
        parsed.push(att);
      }
      setStagedAttachments((prev) => [...prev, ...parsed]);
      flash(`Attached ${parsed.length} file${parsed.length > 1 ? 's' : ''}.`);
    } catch (e) {
      console.error('File attach error:', e);
      flash('Error processing file attachment.');
    } finally {
      setIsAttaching(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeStagedAttachment = (id: string) => {
    setStagedAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const addComment = () => {
    const text = commentText.trim();
    if (!text && stagedAttachments.length === 0) return;

    const defaultText =
      text || `Attached ${stagedAttachments.length} file${stagedAttachments.length > 1 ? 's' : ''}`;

    const updated: Task = {
      ...task,
      comments: [
        ...task.comments,
        {
          id: uid('cm'),
          userId: currentUser.id,
          text: defaultText,
          at: new Date().toISOString(),
          attachments: stagedAttachments.length > 0 ? stagedAttachments : undefined,
        },
      ],
    };
    onUpdate(updated);
    setCommentText('');
    setStagedAttachments([]);
    flash(`Follow-up note recorded${stagedAttachments.length > 0 ? ' with files' : ''}.`);
  };

  const editComment = (commentId: string, newText: string) => {
    if (!newText.trim()) return;
    const updated: Task = {
      ...task,
      comments: task.comments.map((c) =>
        c.id === commentId
          ? { ...c, text: newText.trim(), editedAt: new Date().toISOString() }
          : c
      ),
    };
    onUpdate(updated);
    setEditingCommentId(null);
  };

  const handleAppendFileToExistingComment = async (files: FileList | File[] | null) => {
    if (!targetAppendCommentId || !files || files.length === 0) return;
    try {
      const parsed: CommentAttachment[] = [];
      for (let i = 0; i < files.length; i++) {
        const att = await fileToAttachment(files[i]);
        parsed.push(att);
      }
      const updated: Task = {
        ...task,
        comments: task.comments.map((c) => {
          if (c.id !== targetAppendCommentId) return c;
          return {
            ...c,
            attachments: [...(c.attachments || []), ...parsed],
            editedAt: new Date().toISOString(),
          };
        }),
      };
      onUpdate(updated);
      flash(`Added ${parsed.length} attachment${parsed.length > 1 ? 's' : ''} to note.`);
    } catch (e) {
      console.error(e);
      flash('Failed to attach files to comment.');
    } finally {
      setTargetAppendCommentId(null);
      if (appendFileInputRef.current) appendFileInputRef.current.value = '';
    }
  };

  const removeAttachmentFromComment = (commentId: string, attachmentId: string) => {
    const updated: Task = {
      ...task,
      comments: task.comments.map((c) => {
        if (c.id !== commentId) return c;
        return {
          ...c,
          attachments: (c.attachments || []).filter((a) => a.id !== attachmentId),
        };
      }),
    };
    onUpdate(updated);
    flash('Removed attachment from note.');
  };

  const recordFollowUp = (timestamp: string | null) => {
    if (!timestamp) return;
    const updates: Task = { ...task, lastFollowUp: timestamp };
    if (
      task.nextFollowUpDate &&
      new Date(task.nextFollowUpDate) <= new Date(timestamp)
    ) {
      updates.nextFollowUpDate = null;
    }
    onUpdate(updates);
    flash(`Follow-up recorded for ${fmtDateTime(timestamp)}.`);
  };

  const scheduleNextFollowUp = () => {
    let target: string | null = null;
    if (nextMode === 'date') {
      if (!nextDate) return;
      target = nextDate;
    } else {
      const n = Number(nextDays);
      if (!n || n <= 0) return;
      const d = new Date();
      d.setDate(d.getDate() + n);
      target = d.toISOString().slice(0, 10);
    }
    onUpdate({ ...task, nextFollowUpDate: target });
    flash(`Next follow-up scheduled for ${fmtDate(target)}.`);
  };

  const clearNextFollowUp = () => {
    onUpdate({ ...task, nextFollowUpDate: null });
    flash('Next follow-up cleared.');
  };

  const taskUnits = task.units || (task.unit ? [task.unit] : []);

  return (
    <div className="tw-modal-overlay" onClick={onClose}>
      <div
        className="tw-modal"
        style={{ maxWidth: 720 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="tw-modal-head">
          <div>
            <div className="tw-display" style={{ fontSize: 19, fontWeight: 600 }}>
              {task.title}
            </div>
            <div
              className="tw-mono"
              style={{
                fontSize: 10.5,
                color: 'var(--tw-ink-soft)',
                marginTop: 2,
              }}
            >
              #{task.id.slice(-6).toUpperCase()} · {taskUnits.join(', ')}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {onOpenWhatsApp && (
              <button
                type="button"
                className="tw-btn"
                style={{
                  background: '#25D366',
                  borderColor: '#22BF5B',
                  color: '#FFFFFF',
                  padding: '3px 8px',
                  fontSize: 11.5,
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                }}
                onClick={() => onOpenWhatsApp(task)}
                title="1-Click WhatsApp Action Memo (AI generated 3-line memo)"
              >
                <MessageCircle size={13} />
                <span>WhatsApp</span>
              </button>
            )}
            {editable && (
              <button
                className="tw-iconbtn"
                title="Edit task"
                onClick={() => setShowEdit(true)}
              >
                <Pencil size={16} />
              </button>
            )}
            <button className="tw-iconbtn" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="tw-modal-body">
          <div
            style={{
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              flexWrap: 'wrap',
              marginBottom: 16,
            }}
          >
            <span
              className="tw-badge"
              style={{
                background: (PRIORITY_COLOR[task.priority] || '#3B6E8F') + '22',
                color: PRIORITY_COLOR[task.priority] || '#3B6E8F',
                padding: '4px 10px',
              }}
            >
              {task.priority} priority
            </span>
            <span
              className="tw-badge"
              style={{
                background: (STATUS_COLOR[task.status] || '#8a8478') + '22',
                color: STATUS_COLOR[task.status] || '#8a8478',
                padding: '4px 10px',
              }}
            >
              {STATUS_LABEL[task.status] || task.status}
            </span>

            {/* Assigned Package Badge (if user assigned) */}
            {assignedPkg && pkgColor && (
              <span
                className="tw-badge"
                style={{
                  background: '#FFFFFF',
                  color: pkgColor,
                  border: `1px solid ${pkgColor}`,
                  fontWeight: 600,
                  padding: '4px 10px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
                title={`Assigned Package: ${assignedPkg}`}
              >
                <Layers size={11} /> {assignedPkg}
              </span>
            )}

            {/* Pendency Aging Badge with Red Pulse if stalled */}
            <PendencyBadge
              task={task}
              onTriggerReminder={(t, type) => onOpenWhatsApp?.(t, type)}
              onOpenWhatsApp={onOpenWhatsApp}
            />
            {isOverdue(task) && (
              <span
                className="tw-badge"
                style={{
                  background: '#B23A2E22',
                  color: 'var(--tw-seal)',
                  padding: '4px 10px',
                }}
              >
                <AlertTriangle
                  size={10}
                  style={{ verticalAlign: '-1px', marginRight: 3 }}
                />{' '}
                Overdue
              </span>
            )}
            {(task.tags || []).map((tg) => (
              <span key={tg} className="tw-tag">
                <TagIcon
                  size={10}
                  style={{ verticalAlign: '-1px', marginRight: 3 }}
                />{' '}
                {tg}
              </span>
            ))}
          </div>

          {task.description && (
            <p
              style={{
                fontSize: 13.5,
                color: 'var(--tw-ink)',
                lineHeight: 1.6,
                marginBottom: 16,
              }}
            >
              {task.description}
            </p>
          )}

          <CollapsibleSection title="Task information" icon={ClipboardList} defaultOpen>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 10,
                fontSize: 13,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 10.5,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: 'var(--tw-ink-soft)',
                    marginBottom: 4,
                  }}
                >
                  Assignees
                </div>
                {assigneeList.length ? (
                  <div style={{ fontWeight: 500 }}>
                    {assigneeList.map((a, i) => (
                      <span key={a.id}>
                        <span
                          style={{
                            cursor: 'pointer',
                            textDecoration: 'underline',
                            textDecorationStyle: 'dotted',
                            textUnderlineOffset: '3px',
                            color: 'var(--tw-steel)',
                          }}
                          onClick={() =>
                            setAssigneeView({ id: a.id, name: a.name })
                          }
                          title="Click to view pending tasks"
                        >
                          {a.name}
                        </span>
                        {i < assigneeList.length - 1 ? ', ' : ''}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontWeight: 500, color: 'var(--tw-ink-soft)' }}>
                    Unassigned
                  </div>
                )}
              </div>

              <InfoLine
                label="Allocated by"
                value={creator ? creator.name : '—'}
              />
              <InfoLine
                label="Next follow-up to be taken"
                value={
                  task.nextFollowUpDate ? (
                    <strong
                      style={{
                        fontWeight: 700,
                        color: isFollowUpDue(task) ? '#8B1E0F' : '#1D4ED8',
                      }}
                    >
                      {task.nextFollowUpDate.includes('T')
                        ? fmtDateTime(task.nextFollowUpDate)
                        : fmtDate(task.nextFollowUpDate)}
                    </strong>
                  ) : (
                    'Not scheduled'
                  )
                }
              />
              <InfoLine
                label="Last follow-up taken"
                value={
                  task.lastFollowUp
                    ? fmtDateTime(task.lastFollowUp)
                    : 'Not recorded yet'
                }
              />
              <InfoLine
                label="Pending at"
                value={
                  (task.pendingAt || []).length
                    ? task.pendingAt.join(', ')
                    : 'Not set'
                }
              />
              <InfoLine
                label="Package / Scheme"
                value={
                  assignedPkg && pkgColor ? (
                    <span
                      className="tw-badge"
                      style={{
                        background: '#FFFFFF',
                        border: `1px solid ${pkgColor}`,
                        color: pkgColor,
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <Layers size={10} /> {assignedPkg}
                    </span>
                  ) : (
                    'None (Unassigned)'
                  )
                }
              />
              <InfoLine
                label="Created"
                value={fmtDate(task.createdAt)}
              />
              <InfoLine
                label="Deadline (secondary)"
                value={fmtDeadline(task.deadline)}
                muted
              />
            </div>
          </CollapsibleSection>

          <div style={{ marginBottom: 18 }}>
            <div className="tw-section-title" style={{ fontSize: 14 }}>
              Status & workflow
            </div>
            <div className="tw-status-stepper">
              {STATUSES.map((s) => (
                <div
                  key={s}
                  className={
                    'tw-step' + (s === task.status ? ' current' : '')
                  }
                  style={
                    s === task.status
                      ? { background: STATUS_COLOR[s] }
                      : {}
                  }
                >
                  {STATUS_LABEL[s]}
                </div>
              ))}
            </div>

            {nextStatuses.length > 0 ? (
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  marginTop: 10,
                  flexWrap: 'wrap',
                }}
              >
                {nextStatuses.map((s) => (
                  <button
                    key={s}
                    className="tw-btn tw-btn-ghost"
                    style={{
                      borderColor: STATUS_COLOR[s],
                      color: STATUS_COLOR[s],
                    }}
                    onClick={() => changeStatus(s)}
                  >
                    Move to {STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
            ) : (
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--tw-ink-soft)',
                  marginTop: 8,
                }}
              >
                You do not have permission to change this task&apos;s status further.
              </div>
            )}
          </div>

          {canTrack && (
            <div style={{ marginBottom: 18 }}>
              <div
                className="tw-section-title"
                style={{
                  fontSize: 14,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <Bell size={14} /> Next follow-up to be taken
                  <span
                    className="tw-mono"
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: 'none',
                      letterSpacing: 0,
                      marginLeft: 8,
                      color: isFollowUpDue(task)
                        ? '#8B1E0F'
                        : '#1D4ED8',
                    }}
                  >
                    {task.nextFollowUpDate
                      ? (task.nextFollowUpDate.includes('T')
                          ? fmtDateTime(task.nextFollowUpDate)
                          : fmtDate(task.nextFollowUpDate))
                      : 'Not scheduled'}
                  </span>
                </div>
                {onOpenWhatsApp && (
                  <button
                    type="button"
                    className="tw-btn tw-btn-ghost"
                    style={{
                      padding: '2px 8px',
                      fontSize: 11,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      color: '#075E54',
                      background: '#E8F5E9',
                      borderColor: '#C8E6C9',
                      borderRadius: 4,
                    }}
                    onClick={() => onOpenWhatsApp(task)}
                    title="Generate 1-Click WhatsApp Action Memo"
                  >
                    <MessageCircle size={12} color="#25D366" />
                    <span>WhatsApp Memo</span>
                  </button>
                )}
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: 6,
                  marginBottom: 8,
                }}
              >
                <div
                  className={'tw-unit-tab' + (nextMode === 'days' ? ' active' : '')}
                  onClick={() => setNextMode('days')}
                >
                  In how many days
                </div>
                <div
                  className={'tw-unit-tab' + (nextMode === 'date' ? ' active' : '')}
                  onClick={() => setNextMode('date')}
                >
                  Pick a date
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
              >
                {nextMode === 'date' ? (
                  <input
                    type="date"
                    className="tw-input"
                    style={{ maxWidth: 160 }}
                    value={nextDate}
                    onChange={(e) => setNextDate(e.target.value)}
                  />
                ) : (
                  <>
                    <input
                      type="number"
                      min="1"
                      className="tw-input"
                      style={{ maxWidth: 120 }}
                      placeholder="Days from today"
                      value={nextDays}
                      onChange={(e) => setNextDays(e.target.value)}
                    />
                    <DayQuickPicks
                      value={nextDays}
                      onSelect={setNextDays}
                    />
                    {nextDays && Number(nextDays) > 0 && (
                      <span
                        style={{
                          fontSize: 11.5,
                          fontWeight: 600,
                          color: 'var(--tw-steel)',
                          background: 'var(--tw-paper-deep)',
                          padding: '3px 8px',
                          borderRadius: 4,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        Target: {(() => {
                          const d = new Date();
                          d.setDate(d.getDate() + Number(nextDays));
                          return fmtDate(d.toISOString().slice(0, 10));
                        })()}
                      </span>
                    )}
                  </>
                )}
                <button
                  type="button"
                  className="tw-btn tw-btn-ghost"
                  onClick={scheduleNextFollowUp}
                >
                  Schedule
                </button>
                {task.nextFollowUpDate && (
                  <button
                    type="button"
                    className="tw-btn tw-btn-ghost"
                    style={{ color: 'var(--tw-seal)' }}
                    onClick={clearNextFollowUp}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          )}

          {canTrack && (
            <div style={{ marginBottom: 18 }}>
              <div className="tw-section-title" style={{ fontSize: 14 }}>
                <Clock size={14} /> Last follow-up taken
                <span
                  className="tw-mono"
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: 'none',
                    letterSpacing: 0,
                    marginLeft: 8,
                    color: 'var(--tw-green)',
                  }}
                >
                  {task.lastFollowUp
                    ? fmtDateTime(task.lastFollowUp)
                    : 'Not recorded yet'}
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
              >
                <button
                  type="button"
                  className="tw-btn tw-btn-ghost"
                  onClick={() => recordFollowUp(new Date().toISOString())}
                >
                  Record follow-up now
                </button>
                <input
                  type="date"
                  className="tw-input"
                  style={{ maxWidth: 160 }}
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                />
                <input
                  type="time"
                  className="tw-input"
                  style={{ maxWidth: 120 }}
                  value={followUpTime}
                  onChange={(e) => setFollowUpTime(e.target.value)}
                />
                <button
                  type="button"
                  className="tw-btn tw-btn-ghost"
                  onClick={() =>
                    recordFollowUp(
                      combineDateTime(followUpDate, followUpTime)
                    )
                  }
                >
                  Set date & time
                </button>
              </div>
            </div>
          )}

          {canTrack && (
            <CollapsibleSection
              title="Pending at"
              icon={Building2}
              badge={
                (task.pendingAt || []).length > 0 && (
                  <span
                    className="tw-mono"
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      textTransform: 'none',
                      letterSpacing: 0,
                      color: 'var(--tw-steel)',
                    }}
                  >
                    {task.pendingAt.join(', ')}
                  </span>
                )
              }
            >
              <PendingAtPicker
                selected={task.pendingAt || []}
                onChange={(v) => {
                  const updatedSince = (task.pendingAt || []).join(',') !== v.join(',') ? todayISO() : (task.pendingSince || todayISO());
                  onUpdate({ ...task, pendingAt: v, pendingSince: updatedSince });
                }}
                allOffices={pendingOffices || []}
                allUserNames={users
                  .filter((u) => u.role !== 'admin' && u.active !== false)
                  .map((u) => u.name)}
                onCreateOffice={addPendingOfficeIfNew}
              />

              {/* Pendency Aging Clock & Escalation Triggers Card */}
              {pendencyInfo.office && (
                <div
                  style={{
                    marginTop: 12,
                    padding: 12,
                    borderRadius: 8,
                    background: pendencyInfo.bg,
                    border: `1px solid ${pendencyInfo.border}`,
                    color: pendencyInfo.color,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 8,
                      marginBottom: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Clock size={15} />
                      <span style={{ fontWeight: 700, fontSize: 13 }}>
                        Pendency Aging Clock: {pendencyInfo.days} days stalled
                      </span>
                      <span
                        className={`tw-badge ${pendencyInfo.pulse ? 'tw-pulse-red-badge' : ''}`}
                        style={{
                          background: '#FFFFFF',
                          color: pendencyInfo.color,
                          border: `1px solid ${pendencyInfo.border}`,
                          fontWeight: 700,
                          fontSize: 10.5,
                        }}
                      >
                        {pendencyInfo.tierLabel}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11, color: 'var(--tw-ink-soft)' }}>
                        Pending since:
                      </span>
                      <input
                        type="date"
                        className="tw-input"
                        style={{
                          fontSize: 11,
                          padding: '2px 6px',
                          width: 130,
                          height: 26,
                          background: '#FFFFFF',
                        }}
                        value={
                          task.pendingSince
                            ? task.pendingSince.slice(0, 10)
                            : pendencyInfo.sinceDate
                            ? pendencyInfo.sinceDate.slice(0, 10)
                            : todayISO()
                        }
                        onChange={(e) => {
                          onUpdate({ ...task, pendingSince: e.target.value });
                          flash('Pending-since date updated.');
                        }}
                      />
                    </div>
                  </div>

                  {/* Escalation Trigger Suggestions */}
                  {pendencyInfo.reminderTrigger !== 'none' ? (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        background: '#FFFFFF',
                        borderRadius: 6,
                        border: `1px solid ${pendencyInfo.border}`,
                        marginTop: 6,
                        flexWrap: 'wrap',
                        gap: 8,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <AlertTriangle size={15} color={pendencyInfo.color} />
                        <span style={{ fontSize: 12, fontWeight: 600 }}>
                          {pendencyInfo.reminderTrigger === '2nd_reminder'
                            ? '🚨 2nd Reminder Suggested (Past 20 days stalled at office)'
                            : '⚠️ 1st Reminder Suggested (Past 10 days stalled at office)'}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="tw-btn"
                        style={{
                          background: '#25D366',
                          borderColor: '#22BF5B',
                          color: '#FFFFFF',
                          padding: '4px 10px',
                          fontSize: 11.5,
                        }}
                        onClick={() =>
                          onOpenWhatsApp?.(task)
                        }
                      >
                        <MessageCircle size={13} /> Send WhatsApp Message
                      </button>
                    </div>
                  ) : (
                    <div style={{ fontSize: 11.5, opacity: 0.9 }}>
                      Visual aging tier: Green (0-7 days), Amber (8-21 days), and Red Pulse (21+ days).
                      1st reminder triggers automatically at 10 days; 2nd reminder at 20 days.
                    </div>
                  )}
                </div>
              )}
            </CollapsibleSection>
          )}

          <div style={{ marginBottom: 6 }}>
            <div className="tw-section-title" style={{ fontSize: 14 }}>
              <MessageSquare size={14} /> Comments & follow-up notes
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                marginBottom: 10,
                maxHeight: 280,
                overflowY: 'auto',
              }}
            >
              {task.comments.length === 0 && (
                <div style={{ fontSize: 12.5, color: 'var(--tw-ink-soft)' }}>
                  No remarks yet.
                </div>
              )}
              {task.comments.map((c, idx) => {
                const u = users.find((x) => x.id === c.userId);
                const canEditComment =
                  c.userId === currentUser.id || editable;
                const isEditing = editingCommentId === c.id;

                return (
                  <div
                    key={`${c.id || 'cm'}-${idx}`}
                    className="tw-card"
                    style={{ padding: '8px 10px' }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 11,
                        color: 'var(--tw-ink-soft)',
                        marginBottom: 3,
                      }}
                    >
                      <span
                        style={{ fontWeight: 600, color: 'var(--tw-ink)' }}
                      >
                        {u ? u.name : 'Unknown'}
                      </span>
                      <span
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <span className="tw-mono">
                          {fmtDateTime(c.at)}
                          {c.editedAt ? ' (edited)' : ''}
                        </span>
                        {canEditComment && !isEditing && (
                          <button
                            type="button"
                            className="tw-iconbtn"
                            style={{ padding: 2, color: 'var(--tw-ink-soft)' }}
                            onClick={() => {
                              setTargetAppendCommentId(c.id);
                              appendFileInputRef.current?.click();
                            }}
                            title="Attach file (PDF, Word, PPT, etc.) to this note"
                          >
                            <Paperclip size={12} />
                          </button>
                        )}
                        {canEditComment && !isEditing && (
                          <Pencil
                            size={11}
                            style={{
                              cursor: 'pointer',
                              color: 'var(--tw-ink-soft)',
                            }}
                            onClick={() => {
                              setEditingCommentId(c.id);
                              setEditingText(c.text);
                            }}
                          />
                        )}
                      </span>
                    </div>
                    {isEditing ? (
                      <div>
                        <input
                          className="tw-input"
                          style={{ fontSize: 13, marginBottom: 6 }}
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter')
                              editComment(c.id, editingText);
                            if (e.key === 'Escape')
                              setEditingCommentId(null);
                          }}
                          autoFocus
                        />
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            type="button"
                            className="tw-btn tw-btn-ghost"
                            style={{ padding: '4px 10px', fontSize: 11.5 }}
                            onClick={() => editComment(c.id, editingText)}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="tw-iconbtn"
                            onClick={() => setEditingCommentId(null)}
                          >
                            <X size={13} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: 13, color: 'var(--tw-ink)' }}>
                        {c.text}
                      </div>
                    )}

                    {/* Render attachments in this comment */}
                    {c.attachments && c.attachments.length > 0 && (
                      <CommentAttachmentList
                        attachments={c.attachments}
                        onRemove={
                          canEditComment
                            ? (att) => removeAttachmentFromComment(c.id, att.id)
                            : undefined
                        }
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Staged attachments preview before posting */}
            {stagedAttachments.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 6,
                  padding: '6px 10px',
                  marginBottom: 8,
                  borderRadius: 'var(--tw-radius-sm)',
                  background: '#F0FDF4',
                  border: '1px solid #BBF7D0',
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: '#166534',
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>Attached files ({stagedAttachments.length}) ready to post:</span>
                  <button
                    type="button"
                    className="tw-btn tw-btn-ghost"
                    style={{ padding: '0 4px', fontSize: 10.5, color: '#991B1B' }}
                    onClick={() => setStagedAttachments([])}
                  >
                    Clear all
                  </button>
                </div>
                {stagedAttachments.map((att) => (
                  <AttachmentPill
                    key={att.id}
                    attachment={att}
                    onRemove={(a) => removeStagedAttachment(a.id)}
                    compact
                  />
                ))}
              </div>
            )}

            {/* Drag & drop upload target wrapper */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingOver(true);
              }}
              onDragLeave={() => setIsDraggingOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDraggingOver(false);
                handleFilesChosen(e.dataTransfer.files);
              }}
              style={{
                borderRadius: 'var(--tw-radius-sm)',
                border: isDraggingOver ? '2px dashed #3B82F6' : '1px solid transparent',
                background: isDraggingOver ? '#EFF6FF' : 'transparent',
                transition: 'all 0.15s ease',
                padding: isDraggingOver ? 4 : 0,
              }}
            >
              {isDraggingOver && (
                <div
                  style={{
                    padding: '8px',
                    textAlign: 'center',
                    fontSize: 12,
                    color: '#1D4ED8',
                    fontWeight: 600,
                  }}
                >
                  <Upload size={14} style={{ display: 'inline', marginRight: 5 }} /> Drop PDF, Word, PPT or files here to attach
                </div>
              )}

              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <MentionInput
                    value={commentText}
                    onChange={setCommentText}
                    users={users}
                    onSubmit={addComment}
                    placeholder="Add a remark or follow-up note… (type @ to mention someone)"
                  />
                </div>

                {/* Attach File Button */}
                <button
                  type="button"
                  className="tw-btn tw-btn-ghost"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '6px 10px',
                    fontSize: 12,
                    color: stagedAttachments.length > 0 ? '#15803D' : 'var(--tw-ink)',
                    borderColor: stagedAttachments.length > 0 ? '#86EFAC' : undefined,
                    background: stagedAttachments.length > 0 ? '#F0FDF4' : undefined,
                    flexShrink: 0,
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  title="Attach files: PDF, Word (.docx), PowerPoint (.pptx), Excel (.xlsx), Images"
                  disabled={isAttaching}
                >
                  <Paperclip size={14} />
                  <span>
                    {isAttaching
                      ? 'Attaching…'
                      : stagedAttachments.length > 0
                      ? `+ File (${stagedAttachments.length})`
                      : 'Attach'}
                  </span>
                </button>

                <button
                  type="button"
                  className="tw-btn tw-btn-primary"
                  onClick={addComment}
                  disabled={isAttaching || (!commentText.trim() && stagedAttachments.length === 0)}
                  style={{ padding: '6px 14px', flexShrink: 0 }}
                >
                  Post
                </button>
              </div>

              {/* Supported formats hint */}
              <div
                style={{
                  fontSize: 10.5,
                  color: 'var(--tw-ink-soft)',
                  marginTop: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 4,
                }}
              >
                <span>Supports PDF, Word (.docx), PowerPoint (.pptx), Excel, Text & Images</span>
                <span>or drag & drop files onto this box</span>
              </div>
            </div>

            {/* Hidden file input for new comment */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.rtf,.png,.jpg,.jpeg,.webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
              style={{ display: 'none' }}
              onChange={(e) => handleFilesChosen(e.target.files)}
            />

            {/* Hidden file input for appending to an existing comment */}
            <input
              ref={appendFileInputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.rtf,.png,.jpg,.jpeg,.webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
              style={{ display: 'none' }}
              onChange={(e) => handleAppendFileToExistingComment(e.target.files)}
            />
          </div>

          {editable && (
            <div
              style={{
                marginTop: 22,
                paddingTop: 14,
                borderTop: '1px solid var(--tw-line)',
                display: 'flex',
                justifyContent: 'flex-end',
              }}
            >
              {!confirmDelete ? (
                <button
                  type="button"
                  className="tw-btn tw-btn-ghost"
                  style={{ color: 'var(--tw-seal)' }}
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 size={14} /> Remove task
                </button>
              ) : (
                <div
                  style={{ display: 'flex', gap: 8, alignItems: 'center' }}
                >
                  <span
                    style={{ fontSize: 12.5, color: 'var(--tw-seal)' }}
                  >
                    Remove permanently?
                  </span>
                  <button
                    type="button"
                    className="tw-btn tw-btn-seal"
                    onClick={onDelete}
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    className="tw-btn tw-btn-ghost"
                    onClick={() => setConfirmDelete(false)}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showEdit && (
        <EditTaskModal
          task={task}
          users={users}
          tags={tags}
          addTagIfNew={addTagIfNew}
          packages={packages}
          onClose={() => setShowEdit(false)}
          onSave={(updated) => {
            onUpdate(updated);
            setShowEdit(false);
            flash('Task details updated.');
          }}
        />
      )}

      {assigneeView && (
        <TaskListModal
          title={`${assigneeView.name} — pending tasks`}
          tasks={assigneePendingTasks}
          users={users}
          onOpen={(id) => {
            setAssigneeView(null);
            onOpenTask(id);
          }}
          onClose={() => setAssigneeView(null)}
        />
      )}
    </div>
  );
}
