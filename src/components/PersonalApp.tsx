import React, { useState, useEffect, useRef } from 'react';
import {
  Home,
  LogOut,
  Plus,
  X,
  Bell,
  Clock,
  ClipboardList,
  MessageSquare,
  Trash2,
  Pencil,
  CheckCircle2,
  Briefcase,
  Users,
  Tag as TagIcon,
  Paperclip,
  Upload,
} from 'lucide-react';
import { PersonalTask, Task, User, CommentAttachment } from '../types';
import {
  PERSONAL_STATUSES,
  PERSONAL_STATUS_LABEL,
  PERSONAL_STATUS_COLOR,
  PRIORITY_COLOR,
  PRIORITIES,
} from '../constants';
import {
  todayISO,
  fmtDate,
  fmtDateTime,
  currentTimeHHMM,
  combineDateTime,
  isPersonalFollowUpDue,
  isOverdue,
  uid,
} from '../utils/helpers';
import { loadPersonal, savePersonal } from '../utils/storage';
import { getInitialPersonalTasks } from '../data/seedData';
import { PersonalTaskRow } from './PersonalTaskRow';
import {
  subscribeCloudPersonalTasks,
  savePersonalTaskToCloud,
  deletePersonalTaskFromCloud,
  savePersonalTasksBatchToCloud,
  subscribeCloudPersonalMeta,
  savePersonalMetaToCloud,
} from '../utils/firebase';
import { TaskRow } from './TaskRow';
import {
  CollapsibleSection,
  InfoLine,
  DayQuickPicks,
  TagPicker,
  TaskListModal,
  PersonalTaskListModal,
} from './CommonPickers';
import { fileToAttachment } from '../utils/attachmentStorage';
import { CommentAttachmentList, AttachmentPill } from './CommentAttachmentList';

export function PersonalApp({
  currentUser,
  onLogout,
  officeTasks,
  officeUsers,
  onOpenOfficeTask,
}: {
  currentUser: User | null;
  onLogout: () => void;
  officeTasks: Task[];
  officeUsers: User[];
  onOpenOfficeTask?: (id: string) => void;
}) {
  const [ready, setReady] = useState(false);
  const [tasks, setTasks] = useState<PersonalTask[]>([]);
  const [contacts, setContacts] = useState<string[]>(['Myself']);
  const [tags, setTags] = useState<string[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem('taskreg_personal_selected_id') || null;
    } catch {
      return null;
    }
  });

  const handleSetSelectedId = (id: string | null) => {
    setSelectedId(id);
    try {
      if (id) {
        sessionStorage.setItem('taskreg_personal_selected_id', id);
      } else {
        sessionStorage.removeItem('taskreg_personal_selected_id');
      }
    } catch {}
  };
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [contactFilter, setContactFilter] = useState('ALL');
  const [followUpTab, setFollowUpTab] = useState<'all' | 'overdue'>('all');
  const [listView, setListView] = useState<{
    title: string;
    key: string;
    kind: 'personal' | 'office';
  } | null>(null);

  useEffect(() => {
    let unsubTasks: (() => void) | null = null;
    let unsubMeta: (() => void) | null = null;

    (async () => {
      let t = await loadPersonal<PersonalTask[]>('personal-tasks');
      const SAMPLE_PERSONAL = new Set([
        'Vehicle Service & Pollution Certificate renewal for MH-12-EE-4500',
        'Review medical insurance premium renewal notice',
        'Book return train tickets for regional workshop',
      ]);
      if (t && t.length > 0) {
        t = t.filter((task) => !SAMPLE_PERSONAL.has(task.title));
      } else {
        t = [];
      }
      await savePersonal('personal-tasks', t);
      let c = await loadPersonal<string[]>('personal-contacts');
      if (!c) {
        c = ['Myself', 'Driver - Ramesh', 'Spouse', 'Family'];
        await savePersonal('personal-contacts', c);
      } else if (!c.includes('Myself')) {
        c = ['Myself', ...c];
        await savePersonal('personal-contacts', c);
      }
      let tg = await loadPersonal<string[]>('personal-tags');
      if (!tg) {
        tg = ['Vehicle', 'Maintenance', 'Personal', 'Finance', 'Travel'];
        await savePersonal('personal-tags', tg);
      }
      setTasks(t);
      setContacts(c);
      setTags(tg);
      setReady(true);

      // Connect Firestore Real-Time Subscriptions for Personal Tasks
      if (currentUser?.id) {
        unsubTasks = subscribeCloudPersonalTasks(currentUser.id, (cloudPersonalTasks) => {
          if (cloudPersonalTasks) {
            setTasks(cloudPersonalTasks);
            savePersonal('personal-tasks', cloudPersonalTasks);
          }
        });

        unsubMeta = subscribeCloudPersonalMeta(currentUser.id, (meta) => {
          if (meta) {
            if (meta.contacts && meta.contacts.length > 0) {
              setContacts(meta.contacts);
              savePersonal('personal-contacts', meta.contacts);
            }
            if (meta.tags && meta.tags.length > 0) {
              setTags(meta.tags);
              savePersonal('personal-tags', meta.tags);
            }
          }
        });
      }
    })();

    return () => {
      if (unsubTasks) unsubTasks();
      if (unsubMeta) unsubMeta();
    };
  }, [currentUser?.id]);

  const persistTasks = async (next: PersonalTask[]) => {
    setTasks(next);
    await savePersonal('personal-tasks', next);
    if (currentUser?.id) {
      savePersonalTasksBatchToCloud(next, currentUser.id).catch(console.warn);
    }
  };

  const addContactIfNew = async (name: string) => {
    const clean = name.trim();
    if (!clean) return;
    setContacts((prev) => {
      if (prev.includes(clean)) return prev;
      const next = [...prev, clean];
      savePersonal('personal-contacts', next);
      if (currentUser?.id) {
        savePersonalMetaToCloud(currentUser.id, { contacts: next }).catch(console.warn);
      }
      return next;
    });
  };

  const addPersonalTagIfNew = async (tag: string, currentTags: string[]) => {
    const clean = tag.trim();
    if (!clean) return currentTags;
    if ((currentTags || []).includes(clean)) return currentTags;
    const next = [...currentTags, clean];
    setTags(next);
    await savePersonal('personal-tags', next);
    if (currentUser?.id) {
      savePersonalMetaToCloud(currentUser.id, { tags: next }).catch(console.warn);
    }
    return next;
  };

  const selected = tasks.find((t) => t.id === selectedId) || null;
  const active = tasks.filter(
    (t) => t.status !== 'ARCHIVED' && t.status !== 'DONE'
  );
  const dueForFollowUp = tasks.filter(isPersonalFollowUpDue);
  const done = tasks.filter((t) => t.status === 'DONE');

  const linkedOfficeTasks = (officeTasks || [])
    .filter(
      (t) =>
        (t.pendingAt || []).some(
          (v) => v.trim().toLowerCase() === 'myself'
        ) &&
        t.status !== 'COMPLETED' &&
        t.status !== 'ARCHIVED'
    )
    .sort((a, b) => {
      const av = a.nextFollowUpDate,
        bv = b.nextFollowUpDate;
      if (av && bv) return new Date(av).getTime() - new Date(bv).getTime();
      if (av && !bv) return -1;
      if (!av && bv) return 1;
      return (
        new Date(a.deadline || '9999').getTime() -
        new Date(b.deadline || '9999').getTime()
      );
    });

  const personalListSources: Record<string, PersonalTask[]> = {
    active,
    dueForFollowUp,
    done,
  };

  const filtered = tasks
    .filter((t) => {
      if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
      if (
        contactFilter !== 'ALL' &&
        (t.assignedTo || 'Myself') !== contactFilter
      )
        return false;
      if (followUpTab === 'overdue' && !isPersonalFollowUpDue(t)) return false;
      return true;
    })
    .sort((a, b) => {
      const av = a.nextFollowUpDate,
        bv = b.nextFollowUpDate;
      if (av && bv) return new Date(av).getTime() - new Date(bv).getTime();
      if (av && !bv) return -1;
      if (!av && bv) return 1;
      return (
        new Date(a.dueDate || '9999').getTime() -
        new Date(b.dueDate || '9999').getTime()
      );
    });

  if (!ready) {
    return (
      <div className="tw-body">
        <div className="tw-loading">Opening personal space…</div>
      </div>
    );
  }

  return (
    <div>
      <div className="tw-topbar">
        <div className="tw-brand">
          <Home size={20} color="var(--tw-steel)" />
          <div>
            <div className="tw-brand-title">Personal Space</div>
            <div className="tw-brand-sub">
              {currentUser ? currentUser.name : 'My tasks'} · Errands &
              follow-ups
            </div>
          </div>
        </div>
        <button className="tw-logout" onClick={onLogout} title="Sign out">
          <LogOut size={13} /> Exit
        </button>
      </div>

      <div className="tw-body" style={{ paddingBottom: 60 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            marginBottom: 16,
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div
            className="tw-display"
            style={{ fontSize: 24, fontWeight: 600, color: 'var(--tw-ink)' }}
          >
            Personal Tasks
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="tw-btn"
              onClick={() => setShowNew(true)}
            >
              <Plus size={15} /> Add task
            </button>
          </div>
        </div>

        <div className="tw-kpi-row">
          <div
            className="tw-card tw-kpi"
            style={{ cursor: 'pointer' }}
            onClick={() =>
              setListView({
                title: 'Active tasks',
                key: 'active',
                kind: 'personal',
              })
            }
          >
            <div
              className="tw-stamp"
              style={{ color: 'var(--tw-steel)', width: 60, height: 60 }}
            >
              <div className="tw-stamp-num" style={{ fontSize: 18 }}>
                {active.length}
              </div>
            </div>
            <div className="tw-kpi-text">
              <div className="tw-kpi-label">Active</div>
            </div>
          </div>

          <div
            className="tw-card tw-kpi"
            style={{ cursor: 'pointer' }}
            onClick={() =>
              setListView({
                title: 'Follow-up due',
                key: 'dueForFollowUp',
                kind: 'personal',
              })
            }
          >
            <div className="tw-kpi-text">
              <div
                className="tw-kpi-count"
                style={{ color: 'var(--tw-seal)' }}
              >
                {dueForFollowUp.length}
              </div>
              <div className="tw-kpi-label">Follow-up due</div>
            </div>
            <Bell
              size={24}
              color="var(--tw-seal)"
              style={{ marginLeft: 'auto' }}
            />
          </div>

          <div
            className="tw-card tw-kpi"
            style={{ cursor: 'pointer' }}
            onClick={() =>
              setListView({
                title: 'Done tasks',
                key: 'done',
                kind: 'personal',
              })
            }
          >
            <div className="tw-kpi-text">
              <div
                className="tw-kpi-count"
                style={{ color: 'var(--tw-green)' }}
              >
                {done.length}
              </div>
              <div className="tw-kpi-label">Done</div>
            </div>
            <CheckCircle2
              size={24}
              color="var(--tw-green)"
              style={{ marginLeft: 'auto' }}
            />
          </div>

          <div
            className="tw-card tw-kpi"
            style={{ cursor: 'pointer' }}
            onClick={() =>
              setListView({
                title: 'Pending at "Myself" (Office)',
                key: 'linkedOfficeTasks',
                kind: 'office',
              })
            }
          >
            <div className="tw-kpi-text">
              <div
                className="tw-kpi-count"
                style={{ color: 'var(--tw-steel)' }}
              >
                {linkedOfficeTasks.length}
              </div>
              <div className="tw-kpi-label">Pending at &ldquo;Myself&rdquo; (Office)</div>
            </div>
            <Briefcase
              size={24}
              color="var(--tw-steel)"
              style={{ marginLeft: 'auto' }}
            />
          </div>
        </div>

        {linkedOfficeTasks.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div className="tw-section-title">
              <Briefcase size={16} color="var(--tw-steel)" /> Pending at
              &ldquo;Myself&rdquo; — linked from Office Register
            </div>
            <div
              className="tw-mono"
              style={{
                fontSize: 10.5,
                color: 'var(--tw-ink-soft)',
                marginBottom: 8,
              }}
            >
              These are Office tasks marked &ldquo;Pending at office: Myself.&rdquo; Click
              one to jump back into the Office tab and open it.
            </div>
            {linkedOfficeTasks.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                users={officeUsers || []}
                onOpen={() => onOpenOfficeTask && onOpenOfficeTask(t.id)}
                highlight={isOverdue(t)}
              />
            ))}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            gap: 6,
            marginBottom: 12,
            flexWrap: 'wrap',
          }}
        >
          <div
            className={
              'tw-unit-tab' + (followUpTab === 'all' ? ' active' : '')
            }
            onClick={() => setFollowUpTab('all')}
          >
            All tasks
          </div>
          <div
            className={
              'tw-unit-tab' + (followUpTab === 'overdue' ? ' active' : '')
            }
            onClick={() => setFollowUpTab('overdue')}
          >
            Follow-up overdue{' '}
            {dueForFollowUp.length > 0 ? `(${dueForFollowUp.length})` : ''}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 8,
            marginBottom: 14,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <div
            className={
              'tw-unit-tab' + (statusFilter === 'ALL' ? ' active' : '')
            }
            onClick={() => setStatusFilter('ALL')}
          >
            All
          </div>
          {PERSONAL_STATUSES.map((s) => (
            <div
              key={s}
              className={
                'tw-unit-tab' + (statusFilter === s ? ' active' : '')
              }
              onClick={() => setStatusFilter(s)}
            >
              {PERSONAL_STATUS_LABEL[s]}
            </div>
          ))}

          <select
            className="tw-select"
            style={{ width: 'auto', fontSize: 12, marginLeft: 'auto' }}
            value={contactFilter}
            onChange={(e) => setContactFilter(e.target.value)}
          >
            <option value="ALL">Everyone</option>
            {contacts.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {filtered.length === 0 ? (
          <div
            className="tw-card"
            style={{ padding: 20, color: 'var(--tw-ink-soft)' }}
          >
            {followUpTab === 'overdue'
              ? 'Nothing overdue for follow-up right now.'
              : 'Nothing here yet — add your first personal task.'}
          </div>
        ) : (
          filtered.map((t) => (
            <PersonalTaskRow
              key={t.id}
              task={t}
              onOpen={() => handleSetSelectedId(t.id)}
            />
          ))
        )}
      </div>

      {showNew && (
        <NewPersonalTaskModal
          contacts={contacts}
          addContactIfNew={addContactIfNew}
          tags={tags}
          addTagIfNew={addPersonalTagIfNew}
          onClose={() => setShowNew(false)}
          onCreate={async (draft) => {
            const task: PersonalTask = {
              id: uid('ptsk'),
              status: 'TODO',
              createdAt: new Date().toISOString(),
              lastFollowUp: null,
              comments: [],
              title: draft.title || '',
              description: draft.description || '',
              assignedTo: draft.assignedTo || 'Myself',
              priority: draft.priority || 'Medium',
              dueDate: draft.dueDate || null,
              nextFollowUpDate: draft.nextFollowUpDate || null,
              tags: draft.tags || [],
            };
            await persistTasks([task, ...tasks]);
            setShowNew(false);
          }}
        />
      )}

      {listView && listView.kind === 'personal' && (
        <PersonalTaskListModal
          title={listView.title}
          tasks={personalListSources[listView.key] || []}
          onOpen={(id) => handleSetSelectedId(id)}
          onClose={() => setListView(null)}
        />
      )}

      {listView && listView.kind === 'office' && (
        <TaskListModal
          title={listView.title}
          tasks={linkedOfficeTasks}
          users={officeUsers || []}
          onOpen={(id) => {
            setListView(null);
            onOpenOfficeTask && onOpenOfficeTask(id);
          }}
          onClose={() => setListView(null)}
        />
      )}

      {selected && (
        <PersonalTaskDetail
          task={selected}
          contacts={contacts}
          addContactIfNew={addContactIfNew}
          tags={tags}
          addTagIfNew={addPersonalTagIfNew}
          onClose={() => handleSetSelectedId(null)}
          onUpdate={async (updated) => {
            await persistTasks(
              tasks.map((t) => (t.id === updated.id ? updated : t))
            );
          }}
          onDelete={async () => {
            await persistTasks(tasks.filter((t) => t.id !== selected.id));
            handleSetSelectedId(null);
          }}
        />
      )}
    </div>
  );
}

function PersonalContactPicker({
  value,
  onChange,
  allContacts,
  onCreateContact,
}: {
  value?: string;
  onChange: (val: string) => void;
  allContacts: string[];
  onCreateContact?: (val: string) => Promise<void>;
}) {
  const [showCustom, setShowCustom] = useState(false);
  const [customValue, setCustomValue] = useState('');

  const options =
    value && !allContacts.includes(value)
      ? [value, ...allContacts]
      : allContacts;

  const submitCustom = async () => {
    const clean = customValue.trim();
    if (!clean) return;
    if (!allContacts.includes(clean) && onCreateContact) {
      await onCreateContact(clean);
    }
    onChange(clean);
    setCustomValue('');
    setShowCustom(false);
  };

  return (
    <div>
      <select
        className="tw-select"
        value={showCustom ? 'add_new' : value || 'Myself'}
        onChange={(e) => {
          if (e.target.value === 'add_new') {
            setShowCustom(true);
            return;
          }
          onChange(e.target.value);
        }}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
        <option value="add_new">+ Add new person…</option>
      </select>
      {showCustom && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input
            className="tw-input"
            placeholder="e.g. Driver - Ramesh, Mother, Spouse"
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submitCustom();
              }
            }}
          />
          <button
            type="button"
            className="tw-btn tw-btn-ghost"
            onClick={submitCustom}
          >
            <Plus size={14} /> Add
          </button>
          <button
            type="button"
            className="tw-iconbtn"
            onClick={() => {
              setShowCustom(false);
              setCustomValue('');
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

function NewPersonalTaskModal({
  contacts,
  addContactIfNew,
  tags,
  addTagIfNew,
  onClose,
  onCreate,
}: {
  contacts: string[];
  addContactIfNew?: (name: string) => Promise<void>;
  tags: string[];
  addTagIfNew?: (tag: string, currentTags: string[]) => Promise<string[] | void>;
  onClose: () => void;
  onCreate: (draft: Partial<PersonalTask>) => Promise<void> | void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedTo, setAssignedTo] = useState('Myself');
  const [priority, setPriority] = useState('Medium');
  const [hasDue, setHasDue] = useState(false);
  const [dueDate, setDueDate] = useState(todayISO());
  const [hasNext, setHasNext] = useState(false);
  const [nextMode, setNextMode] = useState<'date' | 'days'>('days');
  const [nextDate, setNextDate] = useState(todayISO());
  const [nextDays, setNextDays] = useState('3');
  const [taskTags, setTaskTags] = useState<string[]>([]);

  const canSubmit = title.trim().length > 0;

  const handleSubmit = () => {
    let nextFollowUpDate: string | null = null;
    if (hasNext) {
      if (nextMode === 'date') {
        nextFollowUpDate = nextDate;
      } else {
        const n = Number(nextDays);
        if (n > 0) {
          const d = new Date();
          d.setDate(d.getDate() + n);
          nextFollowUpDate = `${d.getFullYear()}-${String(
            d.getMonth() + 1
          ).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }
      }
    }

    onCreate({
      title: title.trim(),
      description: description.trim(),
      assignedTo,
      priority,
      dueDate: hasDue ? dueDate : null,
      nextFollowUpDate,
      tags: taskTags,
    });
  };

  return (
    <div className="tw-modal-overlay" onClick={onClose}>
      <div className="tw-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tw-modal-head">
          <div className="tw-display" style={{ fontSize: 18, fontWeight: 600 }}>
            New personal task
          </div>
          <button className="tw-iconbtn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="tw-modal-body">
          <div style={{ marginBottom: 14 }}>
            <label className="tw-label">Title</label>
            <input
              className="tw-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Pay electricity bill"
              autoFocus
            />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label className="tw-label">Description</label>
            <textarea
              className="tw-textarea"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label className="tw-label">Assigned to</label>
            <PersonalContactPicker
              value={assignedTo}
              onChange={setAssignedTo}
              allContacts={contacts}
              onCreateContact={addContactIfNew}
            />
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 14,
              marginBottom: 14,
            }}
          >
            <div>
              <label className="tw-label">Priority</label>
              <select
                className="tw-select"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="tw-label">
                <Bell size={11} style={{ verticalAlign: '-1px' }} /> Next
                follow-up
              </label>
              <div
                style={{
                  display: 'flex',
                  gap: 6,
                  marginBottom: hasNext ? 6 : 0,
                }}
              >
                <div
                  className={'tw-unit-tab' + (!hasNext ? ' active' : '')}
                  onClick={() => setHasNext(false)}
                >
                  Not set
                </div>
                <div
                  className={'tw-unit-tab' + (hasNext ? ' active' : '')}
                  onClick={() => setHasNext(true)}
                >
                  Schedule
                </div>
              </div>
              {hasNext && (
                <div>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                    <div
                      className={
                        'tw-unit-tab' + (nextMode === 'days' ? ' active' : '')
                      }
                      onClick={() => setNextMode('days')}
                    >
                      In how many days
                    </div>
                    <div
                      className={
                        'tw-unit-tab' + (nextMode === 'date' ? ' active' : '')
                      }
                      onClick={() => setNextMode('date')}
                    >
                      Pick a date
                    </div>
                  </div>
                  {nextMode === 'date' ? (
                    <input
                      type="date"
                      className="tw-input"
                      value={nextDate}
                      onChange={(e) => setNextDate(e.target.value)}
                    />
                  ) : (
                    <>
                      <input
                        type="number"
                        min="1"
                        className="tw-input"
                        placeholder="Days from today"
                        value={nextDays}
                        onChange={(e) => setNextDays(e.target.value)}
                      />
                      <DayQuickPicks
                        value={nextDays}
                        onSelect={setNextDays}
                      />
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label
              className="tw-label"
              style={{ color: 'var(--tw-ink-soft)' }}
            >
              Due date{' '}
              <span
                className="tw-mono"
                style={{
                  fontSize: 10,
                  textTransform: 'none',
                  letterSpacing: 0,
                }}
              >
                (secondary)
              </span>
            </label>
            <div
              style={{
                display: 'flex',
                gap: 6,
                marginBottom: hasDue ? 6 : 0,
              }}
            >
              <div
                className={'tw-unit-tab' + (hasDue ? ' active' : '')}
                onClick={() => setHasDue(true)}
              >
                Dated
              </div>
              <div
                className={'tw-unit-tab' + (!hasDue ? ' active' : '')}
                onClick={() => setHasDue(false)}
              >
                No due date
              </div>
            </div>
            {hasDue && (
              <input
                type="date"
                className="tw-input"
                style={{ maxWidth: 220 }}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            )}
          </div>

          <div style={{ marginBottom: 18 }}>
            <label className="tw-label">Tags</label>
            <TagPicker
              allTags={tags}
              selected={taskTags}
              onChange={setTaskTags}
              onCreateTag={addTagIfNew}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button
              type="button"
              className="tw-btn tw-btn-ghost"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="tw-btn"
              disabled={!canSubmit}
              onClick={handleSubmit}
            >
              <Plus size={15} /> Add task
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PersonalTaskDetail({
  task,
  contacts,
  addContactIfNew,
  tags,
  addTagIfNew,
  onClose,
  onUpdate,
  onDelete,
}: {
  task: PersonalTask;
  contacts: string[];
  addContactIfNew?: (name: string) => Promise<void>;
  tags: string[];
  addTagIfNew?: (tag: string, currentTags: string[]) => Promise<string[] | void>;
  onClose: () => void;
  onUpdate: (updated: PersonalTask) => Promise<void> | void;
  onDelete: () => Promise<void> | void;
}) {
  const [commentText, setCommentText] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [followUpDate, setFollowUpDate] = useState(todayISO());
  const [followUpTime, setFollowUpTime] = useState(currentTimeHHMM());
  const [nextMode, setNextMode] = useState<'date' | 'days'>('days');
  const [nextDate, setNextDate] = useState(
    task.nextFollowUpDate || todayISO()
  );
  const [nextDays, setNextDays] = useState('3');
  const [editingAssignee, setEditingAssignee] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [stagedAttachments, setStagedAttachments] = useState<CommentAttachment[]>([]);
  const [isAttaching, setIsAttaching] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [targetAppendCommentId, setTargetAppendCommentId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const appendFileInputRef = useRef<HTMLInputElement>(null);

  const changeStatus = (status: string) =>
    onUpdate({ ...task, status: status as PersonalTask['status'] });

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
    } catch (e) {
      console.error('File attach error:', e);
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

    onUpdate({
      ...task,
      comments: [
        ...(task.comments || []),
        {
          id: uid('cm'),
          text: defaultText,
          at: new Date().toISOString(),
          attachments: stagedAttachments.length > 0 ? stagedAttachments : undefined,
        },
      ],
    });
    setCommentText('');
    setStagedAttachments([]);
  };

  const editComment = (commentId: string, newText: string) => {
    if (!newText.trim()) return;
    onUpdate({
      ...task,
      comments: (task.comments || []).map((c) =>
        c.id === commentId
          ? { ...c, text: newText.trim(), editedAt: new Date().toISOString() }
          : c
      ),
    });
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
      onUpdate({
        ...task,
        comments: (task.comments || []).map((c) => {
          if (c.id !== targetAppendCommentId) return c;
          return {
            ...c,
            attachments: [...(c.attachments || []), ...parsed],
            editedAt: new Date().toISOString(),
          };
        }),
      });
    } catch (e) {
      console.error(e);
    } finally {
      setTargetAppendCommentId(null);
      if (appendFileInputRef.current) appendFileInputRef.current.value = '';
    }
  };

  const removeAttachmentFromComment = (commentId: string, attachmentId: string) => {
    onUpdate({
      ...task,
      comments: (task.comments || []).map((c) => {
        if (c.id !== commentId) return c;
        return {
          ...c,
          attachments: (c.attachments || []).filter((a) => a.id !== attachmentId),
        };
      }),
    });
  };

  const recordFollowUp = (timestamp: string | null) => {
    if (!timestamp) return;
    const updates = { ...task, lastFollowUp: timestamp };
    if (
      task.nextFollowUpDate &&
      new Date(task.nextFollowUpDate) <= new Date(timestamp)
    ) {
      updates.nextFollowUpDate = null;
    }
    onUpdate(updates);
  };

  const scheduleNext = () => {
    let d: string | null = null;
    if (nextMode === 'date') {
      d = nextDate;
    } else {
      const n = Number(nextDays);
      if (n > 0) {
        const dt = new Date();
        dt.setDate(dt.getDate() + n);
        d = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(
          2,
          '0'
        )}-${String(dt.getDate()).padStart(2, '0')}`;
      }
    }
    if (d) onUpdate({ ...task, nextFollowUpDate: d });
  };

  const clearNext = () => onUpdate({ ...task, nextFollowUpDate: null });

  return (
    <div className="tw-modal-overlay" onClick={onClose}>
      <div
        className="tw-modal"
        style={{ maxWidth: 640 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="tw-modal-head">
          <div className="tw-display" style={{ fontSize: 19, fontWeight: 600 }}>
            {task.title}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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
              flexWrap: 'wrap',
              marginBottom: 16,
            }}
          >
            <span
              className="tw-badge"
              style={{
                background:
                  (PERSONAL_STATUS_COLOR[task.status] || '#8a8478') + '22',
                color: PERSONAL_STATUS_COLOR[task.status] || '#8a8478',
                padding: '4px 10px',
              }}
            >
              {PERSONAL_STATUS_LABEL[task.status] || task.status}
            </span>
            {task.priority && (
              <span
                className="tw-badge"
                style={{
                  background:
                    (PRIORITY_COLOR[task.priority] || '#3B6E8F') + '22',
                  color: PRIORITY_COLOR[task.priority] || '#3B6E8F',
                  padding: '4px 10px',
                }}
              >
                {task.priority}
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
                  Assigned to
                </div>
                {editingAssignee ? (
                  <PersonalContactPicker
                    value={task.assignedTo || 'Myself'}
                    onChange={(v) => {
                      onUpdate({ ...task, assignedTo: v });
                      setEditingAssignee(false);
                    }}
                    allContacts={contacts}
                    onCreateContact={addContactIfNew}
                  />
                ) : (
                  <div
                    style={{ fontWeight: 500, cursor: 'pointer' }}
                    onClick={() => setEditingAssignee(true)}
                  >
                    {task.assignedTo || 'Myself'}{' '}
                    <Pencil
                      size={11}
                      style={{
                        verticalAlign: '-1px',
                        marginLeft: 4,
                        color: 'var(--tw-ink-soft)',
                      }}
                    />
                  </div>
                )}
              </div>

              <InfoLine
                label="Next follow-up"
                value={
                  task.nextFollowUpDate
                    ? fmtDate(task.nextFollowUpDate)
                    : 'Not scheduled'
                }
                highlight={isPersonalFollowUpDue(task)}
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
                label="Due date"
                value={task.dueDate ? fmtDate(task.dueDate) : 'Not set'}
                muted
              />
            </div>
          </CollapsibleSection>

          <div style={{ marginBottom: 18 }}>
            <div className="tw-section-title" style={{ fontSize: 14 }}>
              Status
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {PERSONAL_STATUSES.map((s) => (
                <button
                  type="button"
                  key={s}
                  className="tw-btn tw-btn-ghost"
                  disabled={s === task.status}
                  style={{
                    borderColor: PERSONAL_STATUS_COLOR[s],
                    color:
                      s === task.status
                        ? 'var(--tw-ink-soft)'
                        : PERSONAL_STATUS_COLOR[s],
                  }}
                  onClick={() => changeStatus(s)}
                >
                  {PERSONAL_STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 18 }}>
            <div className="tw-section-title" style={{ fontSize: 14 }}>
              <Bell size={14} /> Next follow-up to be taken
              <span
                className="tw-mono"
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: 'none',
                  letterSpacing: 0,
                  marginLeft: 8,
                  color: isPersonalFollowUpDue(task)
                    ? 'var(--tw-seal)'
                    : 'var(--tw-steel)',
                }}
              >
                {task.nextFollowUpDate
                  ? fmtDateTime(task.nextFollowUpDate)
                  : 'Not scheduled'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
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
                  <DayQuickPicks value={nextDays} onSelect={setNextDays} />
                </>
              )}
              <button
                type="button"
                className="tw-btn tw-btn-ghost"
                onClick={scheduleNext}
              >
                Schedule
              </button>
              {task.nextFollowUpDate && (
                <button
                  type="button"
                  className="tw-btn tw-btn-ghost"
                  style={{ color: 'var(--tw-seal)' }}
                  onClick={clearNext}
                >
                  Clear
                </button>
              )}
            </div>
          </div>

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

          <div style={{ marginBottom: 6 }}>
            <div className="tw-section-title" style={{ fontSize: 14 }}>
              <MessageSquare size={14} /> Notes
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                marginBottom: 10,
                maxHeight: 160,
                overflowY: 'auto',
              }}
            >
              {(task.comments || []).length === 0 && (
                <div style={{ fontSize: 12.5, color: 'var(--tw-ink-soft)' }}>
                  No notes yet.
                </div>
              )}
              {(task.comments || []).map((c, idx) => {
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
                        alignItems: 'center',
                        marginBottom: 3,
                      }}
                    >
                      <div
                        className="tw-mono"
                        style={{ fontSize: 10.5, color: 'var(--tw-ink-soft)' }}
                      >
                        {fmtDateTime(c.at)}
                        {c.editedAt ? ' (edited)' : ''}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {!isEditing && (
                          <button
                            type="button"
                            className="tw-iconbtn"
                            style={{ padding: 2, color: 'var(--tw-ink-soft)' }}
                            onClick={() => {
                              setTargetAppendCommentId(c.id);
                              appendFileInputRef.current?.click();
                            }}
                            title="Attach file to this note"
                          >
                            <Paperclip size={12} />
                          </button>
                        )}
                        {!isEditing && (
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
                      </div>
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
                      <div style={{ fontSize: 13 }}>{c.text}</div>
                    )}

                    {c.attachments && c.attachments.length > 0 && (
                      <CommentAttachmentList
                        attachments={c.attachments}
                        onRemove={(att) => removeAttachmentFromComment(c.id, att.id)}
                      />
                    )}
                  </div>
                );
              })}
            </div>

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
                <input
                  className="tw-input"
                  style={{ flex: 1 }}
                  placeholder="Add a note or remark…"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addComment()}
                />

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
                <span>Supports PDF, Word, PowerPoint, Excel, Images & Text files</span>
                <span>or drag & drop files here</span>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.rtf,.png,.jpg,.jpeg,.webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
              style={{ display: 'none' }}
              onChange={(e) => handleFilesChosen(e.target.files)}
            />

            <input
              ref={appendFileInputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.rtf,.png,.jpg,.jpeg,.webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
              style={{ display: 'none' }}
              onChange={(e) => handleAppendFileToExistingComment(e.target.files)}
            />
          </div>

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
                <Trash2 size={14} /> Delete task
              </button>
            ) : (
              <div
                style={{ display: 'flex', gap: 8, alignItems: 'center' }}
              >
                <span
                  style={{ fontSize: 12.5, color: 'var(--tw-seal)' }}
                >
                  Delete permanently?
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
        </div>
      </div>
    </div>
  );
}
