import React, { useState, useMemo } from 'react';
import {
  ClipboardList,
  AlertTriangle,
  Eye,
  CheckCircle2,
  Tag as TagIcon,
  Building2,
  Download,
  Printer,
  Plus,
  ChevronDown,
  ChevronRight,
  User as UserIcon,
  X,
  CalendarDays,
  CheckSquare,
  Square,
  FastForward,
  Clock,
  Layers,
  MessageCircle,
} from 'lucide-react';
import { Task, User } from '../types';
import {
  STATUSES,
  STATUS_LABEL,
  STATUS_COLOR,
  GROUP_FIELD,
  GROUP_DIVISION,
} from '../constants';
import {
  isFollowUpDue,
  isOverdue,
  allUnitsOf,
  isFieldOfficeUnit,
  canCreateTasks,
  exportTasksToExcel,
  groupTasksByTag,
  groupTasksByOffice,
  postponeDate,
  fmtDateTime,
  matchesTaskSearch,
} from '../utils/helpers';
import { matchesPackageFilter, getPackageBadgeColor, getTaskPackage } from '../utils/schemePackage';
import { calculatePendencyInfo } from '../utils/pendencyAging';
import { TaskRow } from './TaskRow';
import { PrintTable } from './PrintTable';
import { TaskListModal } from './CommonPickers';
import { BatchActionBar } from './BatchActionBar';
import { BatchRescheduleModal } from './BatchRescheduleModal';
import { AddUnassignedTasksModal } from './AddUnassignedTasksModal';

const STATUS_FILTER_LABEL: Record<string, string> = {
  PENDING: 'Pending tasks',
  ALL: 'All tasks',
  NOT_STARTED: 'Not Started tasks',
  IN_PROGRESS: 'In Progress tasks',
  UNDER_REVIEW: 'Under Review tasks',
  COMPLETED: 'Completed tasks',
  ARCHIVED: 'Archived tasks',
};

export function Dashboard({
  currentUser,
  tasks,
  allTasks,
  users,
  units,
  unitFilter,
  setUnitFilter,
  tags,
  pendingOffices,
  packages = [],
  onOpenTask,
  onNewTask,
  onUpdateTasks,
  onGoToCalendar,
  onOpenWhatsApp,
  onTriggerReminder,
  flash,
}: {
  currentUser: User;
  tasks: Task[];
  allTasks: Task[];
  users: User[];
  units: string[];
  unitFilter: string;
  setUnitFilter: (filter: string) => void;
  tags: string[];
  pendingOffices: string[];
  packages?: string[];
  onOpenTask: (id: string) => void;
  onNewTask: () => void;
  onUpdateTasks?: (tasks: Task[]) => Promise<void>;
  onGoToCalendar?: (mode?: 'agenda' | 'month' | 'week' | 'matrix') => void;
  onOpenWhatsApp?: (task: Task, reminderType?: string) => void;
  onTriggerReminder?: (task: Task, type: '1st_reminder' | '2nd_reminder') => void;
  flash?: (msg: string) => void;
}) {
  const [listView, setListView] = useState<{
    title: string;
    key: string;
  } | null>(null);
  const [groupByTag, setGroupByTag] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [groupByOffice, setGroupByOffice] = useState(false);
  const [officeFilters, setOfficeFilters] = useState<string[]>([]);
  const [sortMode, setSortMode] = useState<string>('next_soonest');
  const [followUpTab, setFollowUpTab] = useState<'all' | 'overdue' | 'set' | 'not_set'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('PENDING');
  const [selectedScheme, setSelectedScheme] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [addTasksModalPackage, setAddTasksModalPackage] = useState<string | null>(null);

  // Total unassigned tasks in the registry
  const totalUnassignedCount = useMemo(() => {
    return allTasks.filter((t) => !getTaskPackage(t)).length;
  }, [allTasks]);

  const handleAssignTasksToPackage = async (taskIds: string[], targetPackage: string) => {
    if (!onUpdateTasks || taskIds.length === 0) return;
    const idSet = new Set(taskIds);
    const updated = allTasks.map((t) => {
      if (idSet.has(t.id)) {
        return {
          ...t,
          package: targetPackage,
          scheme: targetPackage,
          history: [
            ...(t.history || []),
            {
              status: t.status,
              at: new Date().toISOString(),
              by: currentUser.id,
            },
          ],
        };
      }
      return t;
    });

    await onUpdateTasks(updated);
  };

  const handleUpdateSingleTask = (updatedTask: Task) => {
    const next = tasks.map((t) => (t.id === updatedTask.id ? updatedTask : t));
    onUpdateTasks?.(next);
    flash?.(`Task "${updatedTask.title.slice(0, 24)}…" updated`);
  };

  const counts: Record<string, number> = {};
  STATUSES.forEach(
    (s) => (counts[s] = tasks.filter((t) => t.status === s).length)
  );

  const pendingAtUserNames = [
    'Myself',
    ...users
      .filter((u) => u.role !== 'admin' && u.active !== false)
      .map((u) => u.name),
  ];

  const active = tasks.filter((t) => t.status !== 'ARCHIVED');
  const underReview = tasks.filter((t) => t.status === 'UNDER_REVIEW');
  const completed = tasks.filter((t) => t.status === 'COMPLETED');
  const pending = active.filter((t) => t.status !== 'COMPLETED');

  const followUpOverdueTasks = pending.filter(isFollowUpDue);
  const followUpSetTasks = pending.filter((t) => !!t.nextFollowUpDate);
  const followUpNotSetTasks = pending.filter((t) => !t.nextFollowUpDate);
  const followUpDueTasks = tasks.filter(
    (t) => t.status !== 'COMPLETED' && t.status !== 'ARCHIVED' && isFollowUpDue(t)
  );

  const pendencyAgingBuckets = useMemo(() => {
    const green: Task[] = [];
    const amber: Task[] = [];
    const redPulse: Task[] = [];
    const firstReminders: Task[] = [];
    const secondReminders: Task[] = [];

    for (const t of tasks) {
      if (t.status === 'COMPLETED' || t.status === 'ARCHIVED') continue;
      const info = calculatePendencyInfo(t);
      if (!info.office) continue;
      if (info.tier === 'red_pulse') redPulse.push(t);
      else if (info.tier === 'amber') amber.push(t);
      else if (info.tier === 'green') green.push(t);

      if (info.reminderTrigger === '2nd_reminder') {
        secondReminders.push(t);
      } else if (info.reminderTrigger === '1st_reminder') {
        firstReminders.push(t);
      }
    }

    return { green, amber, redPulse, firstReminders, secondReminders };
  }, [tasks]);

  const listSources: Record<string, Task[]> = {
    followUpDue: followUpDueTasks,
    active,
    pending,
    underReview,
    completed,
    'aging:green': pendencyAgingBuckets.green,
    'aging:amber': pendencyAgingBuckets.amber,
    'aging:red_pulse': pendencyAgingBuckets.redPulse,
    'escalation:1st_reminder': pendencyAgingBuckets.firstReminders,
    'escalation:2nd_reminder': pendencyAgingBuckets.secondReminders,
    ...Object.fromEntries(
      STATUSES.map((s) => [`status:${s}`, tasks.filter((t) => t.status === s)])
    ),
  };

  let baseList: Task[];
  if (statusFilter === 'PENDING') {
    baseList =
      followUpTab === 'overdue'
        ? followUpOverdueTasks
        : followUpTab === 'set'
        ? followUpSetTasks
        : followUpTab === 'not_set'
        ? followUpNotSetTasks
        : pending;
  } else if (statusFilter === 'ALL') {
    baseList = tasks;
  } else {
    baseList = tasks.filter((t) => t.status === statusFilter);
  }

  const schemeFiltered =
    selectedScheme === 'ALL'
      ? baseList
      : baseList.filter((t) => matchesPackageFilter(t, selectedScheme));

  const searched = searchQuery.trim()
    ? schemeFiltered.filter((t) => matchesTaskSearch(t, searchQuery, users))
    : schemeFiltered;

  const listSorted = searched.slice().sort((a, b) => {
    if (sortMode === 'next_soonest' || sortMode === 'next_latest') {
      const av = a.nextFollowUpDate,
        bv = b.nextFollowUpDate;
      if (!av && !bv) return 0;
      if (!av) return 1;
      if (!bv) return -1;
      return sortMode === 'next_soonest'
        ? new Date(av).getTime() - new Date(bv).getTime()
        : new Date(bv).getTime() - new Date(av).getTime();
    }
    if (sortMode === 'last_oldest' || sortMode === 'last_latest') {
      const av = a.lastFollowUp,
        bv = b.lastFollowUp;
      if (!av && !bv) return 0;
      if (!av) return 1;
      if (!bv) return -1;
      return sortMode === 'last_oldest'
        ? new Date(av).getTime() - new Date(bv).getTime()
        : new Date(bv).getTime() - new Date(av).getTime();
    }
    return (
      new Date(a.deadline || '9999').getTime() -
      new Date(b.deadline || '9999').getTime()
    );
  });

  const tagGroups = groupByTag
    ? groupTasksByTag(listSorted, selectedTags)
    : null;
  const officeGroups = groupByOffice
    ? groupTasksByOffice(listSorted, officeFilters)
    : null;

  const toggleSelectTask = (id: string) => {
    setSelectedTaskIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectAllVisible = () => {
    setSelectedTaskIds(listSorted.map((t) => t.id));
  };

  const deselectAll = () => {
    setSelectedTaskIds([]);
  };

  const handleBatchPostpone = async (days: number) => {
    if (!onUpdateTasks || selectedTaskIds.length === 0) return;
    const updated = allTasks.map((t) => {
      if (!selectedTaskIds.includes(t.id)) return t;
      const newDate = postponeDate(t.nextFollowUpDate, days);
      const noteText = `Follow-up batch postponed by +${days} day${days === 1 ? '' : 's'}`;
      return {
        ...t,
        nextFollowUpDate: newDate,
        comments: [
          ...t.comments,
          {
            id: `cm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
            userId: currentUser.id,
            text: noteText,
            at: new Date().toISOString(),
          },
        ],
      };
    });
    await onUpdateTasks(updated);
    flash?.(`Rescheduled ${selectedTaskIds.length} tasks (+${days} days).`);
    deselectAll();
  };

  const handleBatchCustomApply = async (params: {
    targetDateISO: string | null;
    note?: string;
    unselectedTaskIds?: string[];
  }) => {
    if (!onUpdateTasks) return;
    const activeIds = selectedTaskIds.filter(
      (id) => !(params.unselectedTaskIds || []).includes(id)
    );
    if (activeIds.length === 0) {
      setShowBatchModal(false);
      return;
    }

    const updated = allTasks.map((t) => {
      if (!activeIds.includes(t.id)) return t;
      const comments = [...t.comments];
      if (params.note) {
        comments.push({
          id: `cm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
          userId: currentUser.id,
          text: params.note,
          at: new Date().toISOString(),
        });
      }
      return {
        ...t,
        nextFollowUpDate: params.targetDateISO,
        comments,
      };
    });

    await onUpdateTasks(updated);
    setShowBatchModal(false);
    flash?.(
      params.targetDateISO
        ? `Rescheduled ${activeIds.length} tasks to ${fmtDateTime(params.targetDateISO)}.`
        : `Cleared follow-up date for ${activeIds.length} tasks.`
    );
    deselectAll();
  };

  return (
    <div>
      <HeaderRow
        currentUser={currentUser}
        title="Dashboard"
        units={units}
        unitFilter={unitFilter}
        setUnitFilter={setUnitFilter}
        onNewTask={onNewTask}
      />

      {followUpDueTasks.length > 0 && (
        <div
          className="tw-card"
          style={{
            padding: '12px 16px',
            marginBottom: 16,
            borderLeft: '4px solid var(--tw-seal)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
            onClick={() =>
              setListView({ title: 'Follow-up due', key: 'followUpDue' })
            }
          >
            <AlertTriangle size={18} color="var(--tw-seal)" />
            <span
              style={{
                fontSize: 13.5,
                fontWeight: 600,
                color: 'var(--tw-ink)',
              }}
            >
              {followUpDueTasks.length} task
              {followUpDueTasks.length > 1 ? 's' : ''} due for follow-up today
              or earlier
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              className="tw-btn tw-btn-ghost"
              style={{ padding: '6px 12px', fontSize: 12 }}
              onClick={() =>
                setListView({ title: 'Follow-up due', key: 'followUpDue' })
              }
            >
              View List
            </button>
            {onGoToCalendar && (
              <>
                <button
                  type="button"
                  className="tw-btn"
                  style={{
                    padding: '6px 12px',
                    fontSize: 12,
                    background: 'var(--tw-seal)',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                  onClick={() => onGoToCalendar('agenda')}
                >
                  <CalendarDays size={13} /> Follow-up Calendar &rarr;
                </button>
                <button
                  type="button"
                  className="tw-btn tw-btn-ghost"
                  style={{
                    padding: '6px 12px',
                    fontSize: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    border: '1px solid var(--tw-line)',
                  }}
                  onClick={() => onGoToCalendar('matrix')}
                >
                  Eisenhower Matrix &rarr;
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <div className="tw-kpi-row">
        <div
          className="tw-card tw-kpi"
          style={{ cursor: 'pointer' }}
          onClick={() => setListView({ title: 'Active tasks', key: 'active' })}
        >
          <div
            className="tw-stamp"
            style={{ color: 'var(--tw-ink)', width: 60, height: 60 }}
          >
            <div className="tw-stamp-num" style={{ fontSize: 18 }}>
              {active.length}
            </div>
          </div>
          <div className="tw-kpi-text">
            <div className="tw-kpi-label">Active tasks</div>
          </div>
        </div>

        <div
          className="tw-card tw-kpi"
          style={{ cursor: 'pointer' }}
          onClick={() => setListView({ title: 'Pending tasks', key: 'pending' })}
        >
          <div className="tw-kpi-text">
            <div
              className="tw-kpi-count"
              style={{ color: 'var(--tw-seal)' }}
            >
              {pending.length}
            </div>
            <div className="tw-kpi-label">Pending tasks</div>
          </div>
          <AlertTriangle
            size={26}
            color="var(--tw-seal)"
            style={{ marginLeft: 'auto' }}
          />
        </div>

        <div
          className="tw-card tw-kpi"
          style={{ cursor: 'pointer' }}
          onClick={() =>
            setListView({ title: 'Under review', key: 'underReview' })
          }
        >
          <div className="tw-kpi-text">
            <div
              className="tw-kpi-count"
              style={{ color: 'var(--tw-gold)' }}
            >
              {counts.UNDER_REVIEW || 0}
            </div>
            <div className="tw-kpi-label">Under review</div>
          </div>
          <Eye
            size={24}
            color="var(--tw-gold)"
            style={{ marginLeft: 'auto' }}
          />
        </div>

        <div
          className="tw-card tw-kpi"
          style={{ cursor: 'pointer' }}
          onClick={() =>
            setListView({ title: 'Completed tasks', key: 'completed' })
          }
        >
          <div className="tw-kpi-text">
            <div
              className="tw-kpi-count"
              style={{ color: 'var(--tw-green)' }}
            >
              {counts.COMPLETED || 0}
            </div>
            <div className="tw-kpi-label">Completed</div>
          </div>
          <CheckCircle2
            size={24}
            color="var(--tw-green)"
            style={{ marginLeft: 'auto' }}
          />
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.3fr 1fr',
          gap: 20,
        }}
      >
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            <div
              className="tw-section-title"
              style={{ margin: 0 }}
            >
              <ClipboardList size={16} color="var(--tw-seal)" />{' '}
              {STATUS_FILTER_LABEL[statusFilter] || statusFilter}
            </div>

            <div
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <input
                className="tw-input"
                placeholder="Search title, ID, remarks, follow-up notes…"
                style={{ width: 230, fontSize: 12.5, padding: '7px 10px' }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />

              <select
                className="tw-select"
                style={{ fontSize: 12, padding: '7px 8px', width: 'auto' }}
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value)}
              >
                <option value="next_soonest">
                  Sort: Next follow-up (soonest first)
                </option>
                <option value="next_latest">
                  Sort: Next follow-up (latest first)
                </option>
                <option value="last_oldest">
                  Sort: Last follow-up (oldest first)
                </option>
                <option value="last_latest">
                  Sort: Last follow-up (latest first)
                </option>
                <option value="deadline">Sort: Deadline (secondary)</option>
              </select>

              <button
                type="button"
                className={'tw-btn' + (groupByTag ? '' : ' tw-btn-ghost')}
                style={{ padding: '7px 11px', fontSize: 12 }}
                onClick={() => {
                  setGroupByTag((v) => !v);
                  setGroupByOffice(false);
                }}
              >
                <TagIcon size={12} /> Group by tag
              </button>

              <button
                type="button"
                className={'tw-btn' + (groupByOffice ? '' : ' tw-btn-ghost')}
                style={{ padding: '7px 11px', fontSize: 12 }}
                onClick={() => {
                  setGroupByOffice((v) => !v);
                  setGroupByTag(false);
                }}
              >
                <Building2 size={12} /> Pending at
              </button>

              {onGoToCalendar && (
                <button
                  type="button"
                  className="tw-btn tw-btn-ghost"
                  style={{
                    padding: '7px 11px',
                    fontSize: 12,
                    color: 'var(--tw-steel)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                  onClick={onGoToCalendar}
                  title="Open Follow-up Calendar & Agenda"
                >
                  <CalendarDays size={13} /> Follow-up Calendar
                </button>
              )}

              <button
                type="button"
                className={
                  'tw-btn ' +
                  (selectedTaskIds.length > 0
                    ? 'tw-btn-secondary'
                    : 'tw-btn-ghost')
                }
                style={{ padding: '7px 11px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}
                onClick={
                  selectedTaskIds.length === listSorted.length && listSorted.length > 0
                    ? deselectAll
                    : selectAllVisible
                }
                title="Select tasks for batch reschedule"
              >
                {selectedTaskIds.length === listSorted.length && listSorted.length > 0 ? (
                  <>
                    <CheckSquare size={13} /> Deselect
                  </>
                ) : (
                  <>
                    <Square size={13} /> Select (
                    {selectedTaskIds.length
                      ? `${selectedTaskIds.length}/${listSorted.length}`
                      : listSorted.length}
                    )
                  </>
                )}
              </button>

              <button
                type="button"
                className="tw-btn tw-btn-ghost"
                style={{ padding: '7px 9px', fontSize: 12 }}
                title="Export this list to Excel"
                onClick={() =>
                  exportTasksToExcel(
                    listSorted,
                    users,
                    STATUS_FILTER_LABEL[statusFilter]
                  )
                }
              >
                <Download size={13} />
              </button>

              <button
                type="button"
                className="tw-btn tw-btn-ghost"
                style={{ padding: '7px 9px', fontSize: 12 }}
                title="Print / save as PDF"
                onClick={() => window.print()}
              >
                <Printer size={13} />
              </button>
            </div>
          </div>

          <PrintTable
            title={STATUS_FILTER_LABEL[statusFilter] || 'Tasks'}
            tasks={listSorted}
            users={users}
          />

          <div
            style={{
              display: 'flex',
              gap: 6,
              marginBottom: 8,
              flexWrap: 'wrap',
            }}
          >
            <div
              className={
                'tw-unit-tab' + (statusFilter === 'PENDING' ? ' active' : '')
              }
              onClick={() => setStatusFilter('PENDING')}
            >
              Pending
            </div>
            <div
              className={
                'tw-unit-tab' + (statusFilter === 'ALL' ? ' active' : '')
              }
              onClick={() => setStatusFilter('ALL')}
            >
              All statuses
            </div>
            {STATUSES.map((s) => (
              <div
                key={s}
                className={
                  'tw-unit-tab' + (statusFilter === s ? ' active' : '')
                }
                onClick={() => setStatusFilter(s)}
              >
                {STATUS_LABEL[s]}
              </div>
            ))}
          </div>

          {statusFilter === 'PENDING' && (
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
                All pending
              </div>
              <div
                className={
                  'tw-unit-tab' + (followUpTab === 'overdue' ? ' active' : '')
                }
                onClick={() => setFollowUpTab('overdue')}
              >
                Follow-up overdue{' '}
                {followUpOverdueTasks.length > 0
                  ? `(${followUpOverdueTasks.length})`
                  : ''}
              </div>
              <div
                className={
                  'tw-unit-tab' + (followUpTab === 'set' ? ' active' : '')
                }
                onClick={() => setFollowUpTab('set')}
              >
                Follow-up set{' '}
                {followUpSetTasks.length > 0
                  ? `(${followUpSetTasks.length})`
                  : ''}
              </div>
              <div
                className={
                  'tw-unit-tab' + (followUpTab === 'not_set' ? ' active' : '')
                }
                onClick={() => setFollowUpTab('not_set')}
              >
                Follow-up not set{' '}
                {followUpNotSetTasks.length > 0
                  ? `(${followUpNotSetTasks.length})`
                  : ''}
              </div>
            </div>
          )}

          {/* Scheme / Package Filter Pill Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginBottom: 14,
              padding: '8px 12px',
              background: '#F8FAFC',
              borderRadius: 'var(--tw-radius-sm)',
              border: '1px solid var(--tw-line)',
              flexWrap: 'wrap',
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 11.5,
                fontWeight: 700,
                color: 'var(--tw-ink)',
                marginRight: 4,
              }}
            >
              <Layers size={13} color="var(--tw-steel)" /> Package / Scheme:
            </div>

            {(!packages || packages.length === 0) ? (
              <span style={{ fontSize: 11.5, color: 'var(--tw-ink-soft)', fontStyle: 'italic' }}>
                No packages created yet. Add packages in Admin &gt; Packages &amp; Schemes to organize tasks by contract packages.
              </span>
            ) : (
              <>
                <button
                  type="button"
                  className={'tw-unit-tab' + (selectedScheme === 'ALL' ? ' active' : '')}
                  style={{
                    fontSize: 11,
                    padding: '3px 10px',
                    borderRadius: 12,
                    fontWeight: selectedScheme === 'ALL' ? 600 : 400,
                  }}
                  onClick={() => setSelectedScheme('ALL')}
                >
                  All Packages ({baseList.length})
                </button>

                {packages.map((pkg) => {
                  const pkgColor = getPackageBadgeColor(pkg);
                  const pkgCount = baseList.filter((t) => matchesPackageFilter(t, pkg)).length;
                  const isSelected = selectedScheme.toLowerCase() === pkg.toLowerCase();
                  return (
                    <button
                      key={pkg}
                      type="button"
                      className={'tw-unit-tab' + (isSelected ? ' active' : '')}
                      style={{
                        fontSize: 11,
                        padding: '3px 8px',
                        borderRadius: 12,
                        fontWeight: isSelected ? 600 : 400,
                        borderColor: isSelected ? pkgColor : undefined,
                        background: isSelected ? pkgColor : undefined,
                        color: isSelected ? '#FFFFFF' : undefined,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                      }}
                      onClick={() => setSelectedScheme(isSelected ? 'ALL' : pkg)}
                      title={`Filter to tasks assigned to ${pkg}. Click to select and see option to add unassigned tasks.`}
                    >
                      <span>{pkg}</span>
                      <span
                        style={{
                          opacity: isSelected ? 0.9 : 0.65,
                          fontSize: 10,
                        }}
                      >
                        ({pkgCount})
                      </span>
                      {/* Direct "+ Add" button on package */}
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedScheme(pkg);
                          setAddTasksModalPackage(pkg);
                        }}
                        title={`Add unassigned tasks to ${pkg}`}
                        style={{
                          marginLeft: 2,
                          background: isSelected ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.06)',
                          color: isSelected ? '#FFFFFF' : 'var(--tw-ink)',
                          padding: '1px 5px',
                          borderRadius: 6,
                          fontSize: 9.5,
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 2,
                          cursor: 'pointer',
                        }}
                      >
                        <Plus size={10} /> Add
                      </span>
                    </button>
                  );
                })}

                <button
                  type="button"
                  className={'tw-unit-tab' + (selectedScheme === 'UNASSIGNED' ? ' active' : '')}
                  style={{
                    fontSize: 11,
                    padding: '3px 9px',
                    borderRadius: 12,
                    fontWeight: selectedScheme === 'UNASSIGNED' ? 600 : 400,
                  }}
                  onClick={() => setSelectedScheme(selectedScheme === 'UNASSIGNED' ? 'ALL' : 'UNASSIGNED')}
                  title="Filter to tasks without an assigned package"
                >
                  <span>Unassigned</span>
                  <span
                    style={{
                      marginLeft: 4,
                      opacity: selectedScheme === 'UNASSIGNED' ? 0.9 : 0.65,
                      fontSize: 10,
                    }}
                  >
                    ({baseList.filter((t) => matchesPackageFilter(t, 'UNASSIGNED')).length})
                  </span>
                </button>
              </>
            )}

            {/* When a package is clicked / selected, show prominent option bar to add unassigned tasks */}
            {selectedScheme !== 'ALL' && selectedScheme !== 'UNASSIGNED' && (
              <div
                style={{
                  width: '100%',
                  marginTop: 6,
                  padding: '7px 12px',
                  borderRadius: 8,
                  background: 'linear-gradient(90deg, #F0F7FF 0%, #F8FAFC 100%)',
                  border: '1px solid #BFDBFE',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 8,
                  animation: 'fadeIn 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      background: getPackageBadgeColor(selectedScheme),
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 10,
                    }}
                  >
                    {selectedScheme}
                  </span>
                  <span style={{ fontSize: 11.5, color: 'var(--tw-ink-soft)' }}>
                    {baseList.filter((t) => matchesPackageFilter(t, selectedScheme)).length} task(s) assigned
                  </span>
                </div>

                <button
                  type="button"
                  className="tw-btn tw-btn-primary"
                  onClick={() => setAddTasksModalPackage(selectedScheme)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 11.5,
                    fontWeight: 600,
                    padding: '4px 12px',
                    borderRadius: 6,
                    background: '#2563EB',
                    color: '#ffffff',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 1px 3px rgba(37,99,235,0.25)',
                  }}
                  title={`Add unassigned tasks to ${selectedScheme}`}
                >
                  <Plus size={13} />
                  <span>Add Unassigned Tasks ({totalUnassignedCount} available)</span>
                </button>
              </div>
            )}
          </div>

          {groupByTag && (
            <TagFilterBar
              allTags={tags}
              selectedTags={selectedTags}
              setSelectedTags={setSelectedTags}
            />
          )}

          {groupByOffice && (
            <OfficeFilterTabs
              allUserNames={pendingAtUserNames}
              allOffices={pendingOffices}
              officeFilters={officeFilters}
              setOfficeFilters={setOfficeFilters}
            />
          )}

          {!groupByTag && !groupByOffice && (
            listSorted.length > 0 ? (
              <div>
                {listSorted.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    users={users}
                    currentUser={currentUser}
                    onOpen={() => onOpenTask(t.id)}
                    onUpdateTask={handleUpdateSingleTask}
                    highlight={isOverdue(t)}
                    selectable
                    selected={selectedTaskIds.includes(t.id)}
                    onToggleSelect={() => toggleSelectTask(t.id)}
                    onOpenWhatsApp={onOpenWhatsApp}
                    onTriggerReminder={onTriggerReminder}
                  />
                ))}
              </div>
            ) : (
              <div
                className="tw-card"
                style={{
                  padding: 24,
                  color: 'var(--tw-ink-soft)',
                  fontSize: 13,
                  textAlign: 'center',
                }}
              >
                {searchQuery.trim() ? (
                  'No tasks match your search.'
                ) : selectedScheme !== 'ALL' && selectedScheme !== 'UNASSIGNED' ? (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--tw-ink)' }}>
                      No tasks assigned to package "{selectedScheme}" yet.
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--tw-ink-soft)' }}>
                      You have {totalUnassignedCount} unassigned tasks in the registry.
                    </div>
                    <button
                      type="button"
                      className="tw-btn tw-btn-primary"
                      onClick={() => setAddTasksModalPackage(selectedScheme)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '6px 16px',
                        fontSize: 12.5,
                        fontWeight: 600,
                        marginTop: 4,
                      }}
                    >
                      <Plus size={14} /> Add Unassigned Tasks With Tickboxes
                    </button>
                  </div>
                ) : (
                  'Register clear — nothing here right now.'
                )}
              </div>
            )
          )}

          {groupByTag && tagGroups && (
            <TagGroupedList
              tagGroups={tagGroups}
              users={users}
              currentUser={currentUser}
              onOpenTask={onOpenTask}
              onUpdateTask={handleUpdateSingleTask}
              onOpenWhatsApp={onOpenWhatsApp}
              onTriggerReminder={onTriggerReminder}
            />
          )}

          {groupByOffice && officeGroups && (
            <OfficeGroupedList
              officeGroups={officeGroups}
              users={users}
              currentUser={currentUser}
              onOpenTask={onOpenTask}
              onUpdateTask={handleUpdateSingleTask}
              onOpenWhatsApp={onOpenWhatsApp}
              onTriggerReminder={onTriggerReminder}
            />
          )}
        </div>

        <div>
          {/* Pendency Aging Clock & Escalation Triggers Card */}
          <div style={{ marginBottom: 20 }}>
            <div className="tw-section-title">
              <Clock size={16} color="var(--tw-steel)" /> Pendency Aging Clock
            </div>
            <div className="tw-card" style={{ padding: 14 }}>
              <div
                style={{
                  fontSize: 11.5,
                  color: 'var(--tw-ink-soft)',
                  marginBottom: 10,
                  lineHeight: 1.4,
                }}
              >
                File pendency tracking at administrative desks and field offices:
              </div>

              {/* Three Visual Aging Tiers Badges */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: 8,
                  marginBottom: 14,
                }}
              >
                <div
                  style={{
                    background: '#ECFDF5',
                    border: '1px solid #A7F3D0',
                    borderRadius: 6,
                    padding: '8px 6px',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'transform 0.15s ease',
                  }}
                  onClick={() =>
                    setListView({
                      title: 'Normal Pendency (0–7 Days at Office)',
                      key: 'aging:green',
                    })
                  }
                  title="Files pending at office 0 to 7 days"
                >
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: '#065F46',
                      textTransform: 'uppercase',
                    }}
                  >
                    0–7 Days
                  </div>
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 800,
                      color: '#065F46',
                      margin: '2px 0',
                    }}
                  >
                    {pendencyAgingBuckets.green.length}
                  </div>
                  <div style={{ fontSize: 9.5, color: '#047857', fontWeight: 500 }}>
                    Normal (Green)
                  </div>
                </div>

                <div
                  style={{
                    background: '#FFFBEB',
                    border: '1px solid #FDE68A',
                    borderRadius: 6,
                    padding: '8px 6px',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'transform 0.15s ease',
                  }}
                  onClick={() =>
                    setListView({
                      title: 'Attention Pendency (8–21 Days at Office)',
                      key: 'aging:amber',
                    })
                  }
                  title="Files pending at office 8 to 21 days"
                >
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: '#92400E',
                      textTransform: 'uppercase',
                    }}
                  >
                    8–21 Days
                  </div>
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 800,
                      color: '#92400E',
                      margin: '2px 0',
                    }}
                  >
                    {pendencyAgingBuckets.amber.length}
                  </div>
                  <div style={{ fontSize: 9.5, color: '#B45309', fontWeight: 500 }}>
                    Attention (Amber)
                  </div>
                </div>

                <div
                  className={
                    pendencyAgingBuckets.redPulse.length > 0
                      ? 'tw-pulse-red-badge'
                      : ''
                  }
                  style={{
                    background: '#FEF2F2',
                    border: '1px solid #F87171',
                    borderRadius: 6,
                    padding: '8px 6px',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'transform 0.15s ease',
                  }}
                  onClick={() =>
                    setListView({
                      title: 'Severely Stalled Files (21+ Days Stalled)',
                      key: 'aging:red_pulse',
                    })
                  }
                  title="Files stalled at office 21+ days"
                >
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: '#991B1B',
                      textTransform: 'uppercase',
                    }}
                  >
                    21+ Days
                  </div>
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 800,
                      color: '#DC2626',
                      margin: '2px 0',
                    }}
                  >
                    {pendencyAgingBuckets.redPulse.length}
                  </div>
                  <div
                    style={{
                      fontSize: 9.5,
                      color: '#B91C1C',
                      fontWeight: 700,
                    }}
                  >
                    Stalled (Red Pulse)
                  </div>
                </div>
              </div>

              {/* Automatic Escalation Triggers: 1st Reminder (10d) & 2nd Reminder (20d) */}
              <div
                style={{
                  borderTop: '1px solid var(--tw-line)',
                  paddingTop: 10,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'var(--tw-ink)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    marginBottom: 8,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  <AlertTriangle size={12} color="var(--tw-seal)" /> Escalation Triggers
                </div>

                {pendencyAgingBuckets.firstReminders.length === 0 &&
                pendencyAgingBuckets.secondReminders.length === 0 ? (
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--tw-ink-soft)',
                      fontStyle: 'italic',
                    }}
                  >
                    No files currently stuck past 10 or 20 days.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {pendencyAgingBuckets.secondReminders.length > 0 && (
                      <div
                        style={{
                          background: '#FEF2F2',
                          border: '1px solid #FECACA',
                          borderRadius: 6,
                          padding: '7px 9px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 6,
                        }}
                      >
                        <div
                          style={{ cursor: 'pointer', flex: 1 }}
                          onClick={() =>
                            setListView({
                              title: 'Files Stuck Past 20 Days (2nd Reminder Suggested)',
                              key: 'escalation:2nd_reminder',
                            })
                          }
                        >
                          <div
                            style={{
                              fontSize: 11.5,
                              fontWeight: 700,
                              color: '#991B1B',
                            }}
                          >
                            🚨 2nd Reminder Suggested ({pendencyAgingBuckets.secondReminders.length})
                          </div>
                          <div style={{ fontSize: 10.5, color: '#B91C1C' }}>
                            Stuck past 20 days at office
                          </div>
                        </div>
                        {onOpenWhatsApp && (
                          <button
                            type="button"
                            className="tw-btn"
                            style={{
                              background: '#DC2626',
                              color: '#FFFFFF',
                              padding: '3px 8px',
                              fontSize: 11,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                            onClick={() =>
                              onOpenWhatsApp(
                                pendencyAgingBuckets.secondReminders[0]
                              )
                            }
                            title="Open WhatsApp message for this file"
                          >
                            <MessageCircle size={11} /> WhatsApp
                          </button>
                        )}
                      </div>
                    )}

                    {pendencyAgingBuckets.firstReminders.length > 0 && (
                      <div
                        style={{
                          background: '#FFFBEB',
                          border: '1px solid #FDE68A',
                          borderRadius: 6,
                          padding: '7px 9px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 6,
                        }}
                      >
                        <div
                          style={{ cursor: 'pointer', flex: 1 }}
                          onClick={() =>
                            setListView({
                              title: 'Files Stuck Past 10 Days (1st Reminder Suggested)',
                              key: 'escalation:1st_reminder',
                            })
                          }
                        >
                          <div
                            style={{
                              fontSize: 11.5,
                              fontWeight: 700,
                              color: '#92400E',
                            }}
                          >
                            ⚠️ 1st Reminder Suggested ({pendencyAgingBuckets.firstReminders.length})
                          </div>
                          <div style={{ fontSize: 10.5, color: '#B45309' }}>
                            Stuck past 10 days at office
                          </div>
                        </div>
                        {onOpenWhatsApp && (
                          <button
                            type="button"
                            className="tw-btn"
                            style={{
                              background: '#D97706',
                              color: '#FFFFFF',
                              padding: '3px 8px',
                              fontSize: 11,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                            onClick={() =>
                              onOpenWhatsApp(
                                pendencyAgingBuckets.firstReminders[0]
                              )
                            }
                            title="Open WhatsApp message for this file"
                          >
                            <MessageCircle size={11} /> WhatsApp
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="tw-section-title">
            <ClipboardList size={16} /> Status distribution
          </div>
          <div className="tw-card" style={{ padding: 16 }}>
            {STATUSES.map((s) => (
              <div
                key={s}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 10,
                  cursor: 'pointer',
                }}
                onClick={() =>
                  setListView({
                    title: STATUS_LABEL[s] + ' tasks',
                    key: 'status:' + s,
                  })
                }
              >
                <div
                  style={{
                    width: 100,
                    fontSize: 12,
                    color: 'var(--tw-ink-soft)',
                  }}
                >
                  {STATUS_LABEL[s]}
                </div>
                <div
                  style={{
                    flex: 1,
                    background: 'var(--tw-paper-deep)',
                    borderRadius: 20,
                    height: 10,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${
                        tasks.length ? ((counts[s] || 0) / tasks.length) * 100 : 0
                      }%`,
                      background: STATUS_COLOR[s],
                      height: '100%',
                    }}
                  />
                </div>
                <div
                  className="tw-mono"
                  style={{
                    width: 24,
                    textAlign: 'right',
                    fontSize: 12.5,
                    fontWeight: 600,
                  }}
                >
                  {counts[s] || 0}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {listView && (
        <TaskListModal
          title={listView.title}
          tasks={listSources[listView.key] || []}
          users={users}
          onOpen={(id) => onOpenTask(id)}
          onClose={() => setListView(null)}
          onOpenWhatsApp={onOpenWhatsApp}
          onTriggerReminder={onTriggerReminder}
          onUpdateTask={handleUpdateSingleTask}
        />
      )}

      {/* Floating Batch Action Bar */}
      <BatchActionBar
        selectedCount={selectedTaskIds.length}
        totalCount={listSorted.length}
        onPostponeTwoDays={() => handleBatchPostpone(2)}
        onPostponeOneWeek={() => handleBatchPostpone(7)}
        onOpenCustomModal={() => setShowBatchModal(true)}
        onClearDate={async () => {
          await handleBatchCustomApply({ targetDateISO: null });
        }}
        onDeselectAll={deselectAll}
        onSelectAllVisible={selectAllVisible}
      />

      {/* Batch Custom Date Modal */}
      {showBatchModal && (
        <BatchRescheduleModal
          selectedTasks={allTasks.filter((t) => selectedTaskIds.includes(t.id))}
          onClose={() => setShowBatchModal(false)}
          onApply={handleBatchCustomApply}
        />
      )}

      {/* Add Unassigned Tasks Modal with Multiple Selection & Tickboxes */}
      {addTasksModalPackage && (
        <AddUnassignedTasksModal
          packageName={addTasksModalPackage}
          allTasks={allTasks}
          users={users}
          units={units}
          currentUser={currentUser}
          onClose={() => setAddTasksModalPackage(null)}
          onAssignTasks={handleAssignTasksToPackage}
          flash={flash}
        />
      )}
    </div>
  );
}

function HeaderRow({
  currentUser,
  title,
  units,
  unitFilter,
  setUnitFilter,
  onNewTask,
}: {
  currentUser: User;
  title: string;
  units: string[];
  unitFilter: string;
  setUnitFilter: (u: string) => void;
  onNewTask: () => void;
}) {
  const scopeUnits =
    currentUser.role === 'admin' ? units : allUnitsOf(currentUser);
  const showTabs = currentUser.role === 'admin' || scopeUnits.length > 1;
  const scopeHasField = scopeUnits.some(isFieldOfficeUnit);
  const scopeHasDivision = scopeUnits.some((u) => !isFieldOfficeUnit(u));

  return (
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
      <div>
        <div
          className="tw-display"
          style={{ fontSize: 24, fontWeight: 600, color: 'var(--tw-ink)' }}
        >
          {title}
        </div>
        {showTabs ? (
          <div
            style={{
              display: 'flex',
              gap: 6,
              marginTop: 8,
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            <div
              className={
                'tw-unit-tab' + (unitFilter === 'ALL' ? ' active' : '')
              }
              onClick={() => setUnitFilter('ALL')}
            >
              All units
            </div>
            {scopeHasField && (
              <div
                className={
                  'tw-unit-tab' +
                  (unitFilter === GROUP_FIELD ? ' active' : '')
                }
                onClick={() => setUnitFilter(GROUP_FIELD)}
              >
                Field Offices
              </div>
            )}
            {scopeHasDivision && (
              <div
                className={
                  'tw-unit-tab' +
                  (unitFilter === GROUP_DIVISION ? ' active' : '')
                }
                onClick={() => setUnitFilter(GROUP_DIVISION)}
              >
                Division Office
              </div>
            )}
            <div
              style={{
                width: 1,
                height: 18,
                background: 'var(--tw-line)',
                margin: '0 2px',
              }}
            />
            {scopeUnits.map((u) => (
              <div
                key={u}
                className={
                  'tw-unit-tab' + (unitFilter === u ? ' active' : '')
                }
                onClick={() => setUnitFilter(u)}
              >
                {u}
              </div>
            ))}
          </div>
        ) : (
          <div
            className="tw-mono"
            style={{
              fontSize: 11.5,
              color: 'var(--tw-ink-soft)',
              marginTop: 4,
            }}
          >
            <Building2 size={12} style={{ verticalAlign: '-2px' }} />{' '}
            {scopeUnits[0] || '—'}
          </div>
        )}
      </div>

      {canCreateTasks(currentUser) && (
        <button type="button" className="tw-btn" onClick={onNewTask}>
          <Plus size={15} /> Allocate task
        </button>
      )}
    </div>
  );
}

function TagFilterBar({
  allTags,
  selectedTags,
  setSelectedTags,
}: {
  allTags: string[];
  selectedTags: string[];
  setSelectedTags: React.Dispatch<React.SetStateAction<string[]>>;
}) {
  const toggle = (tag: string) =>
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );

  return (
    <div
      className="tw-card"
      style={{
        padding: 10,
        marginBottom: 14,
        display: 'flex',
        gap: 6,
        flexWrap: 'wrap',
        alignItems: 'center',
      }}
    >
      <span
        style={{
          fontSize: 11.5,
          color: 'var(--tw-ink-soft)',
          marginRight: 4,
        }}
      >
        Filter tags:
      </span>
      {(!allTags || allTags.length === 0) && (
        <span style={{ fontSize: 12, color: 'var(--tw-ink-soft)' }}>
          No tags created yet.
        </span>
      )}
      {(allTags || []).map((tag) => (
        <div
          key={tag}
          className={
            'tw-unit-tab' + (selectedTags.includes(tag) ? ' active' : '')
          }
          onClick={() => toggle(tag)}
        >
          <TagIcon
            size={10}
            style={{ verticalAlign: '-1px', marginRight: 3 }}
          />
          {tag}
        </div>
      ))}
      {selectedTags.length > 0 && (
        <button
          type="button"
          className="tw-iconbtn"
          onClick={() => setSelectedTags([])}
          title="Clear tag filter"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

function OfficeFilterTabs({
  allUserNames,
  allOffices,
  officeFilters,
  setOfficeFilters,
}: {
  allUserNames: string[];
  allOffices: string[];
  officeFilters: string[];
  setOfficeFilters: React.Dispatch<React.SetStateAction<string[]>>;
}) {
  const [subTab, setSubTab] = useState<'users' | 'offices' | null>(null);
  const userNames = allUserNames || [];
  const officeNames = allOffices || [];
  if (userNames.length === 0 && officeNames.length === 0) return null;

  const toggle = (o: string) =>
    setOfficeFilters((prev) =>
      prev.includes(o) ? prev.filter((x) => x !== o) : [...prev, o]
    );

  return (
    <div className="tw-card" style={{ padding: 10, marginBottom: 14 }}>
      <div
        style={{
          display: 'flex',
          gap: 6,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            fontSize: 11.5,
            color: 'var(--tw-ink-soft)',
            marginRight: 4,
          }}
        >
          Pending at:
        </span>
        {userNames.length > 0 && (
          <div
            className={'tw-unit-tab' + (subTab === 'users' ? ' active' : '')}
            onClick={() => setSubTab(subTab === 'users' ? null : 'users')}
          >
            <UserIcon
              size={11}
              style={{ verticalAlign: '-1px', marginRight: 3 }}
            />{' '}
            Users
          </div>
        )}
        {officeNames.length > 0 && (
          <div
            className={'tw-unit-tab' + (subTab === 'offices' ? ' active' : '')}
            onClick={() => setSubTab(subTab === 'offices' ? null : 'offices')}
          >
            <Building2
              size={11}
              style={{ verticalAlign: '-1px', marginRight: 3 }}
            />{' '}
            Offices
          </div>
        )}
        {officeFilters.length > 0 && (
          <button
            type="button"
            className="tw-iconbtn"
            onClick={() => setOfficeFilters([])}
            title="Clear filter"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {subTab === 'users' && (
        <div
          style={{
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
            marginTop: 10,
          }}
        >
          {userNames.map((o) => (
            <div
              key={o}
              className={
                'tw-unit-tab' + (officeFilters.includes(o) ? ' active' : '')
              }
              onClick={() => toggle(o)}
            >
              {o}
            </div>
          ))}
        </div>
      )}

      {subTab === 'offices' && (
        <div
          style={{
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
            marginTop: 10,
          }}
        >
          {officeNames.map((o) => (
            <div
              key={o}
              className={
                'tw-unit-tab' + (officeFilters.includes(o) ? ' active' : '')
              }
              onClick={() => toggle(o)}
            >
              {o}
            </div>
          ))}
        </div>
      )}

      {officeFilters.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
            marginTop: 10,
          }}
        >
          {officeFilters.map((val) => (
            <span
              key={val}
              className="tw-tag"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '3px 8px',
              }}
            >
              {val}
              <X
                size={11}
                style={{ cursor: 'pointer' }}
                onClick={() => toggle(val)}
              />
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function TagGroupedList({
  tagGroups,
  users,
  currentUser,
  onOpenTask,
  onUpdateTask,
  onOpenWhatsApp,
  onTriggerReminder,
}: {
  tagGroups: {
    sortedTags: string[];
    map: Record<string, Task[]>;
    untagged: Task[];
  };
  users: User[];
  currentUser?: User;
  onOpenTask: (id: string) => void;
  onUpdateTask?: (updated: Task) => void;
  onOpenWhatsApp?: (task: Task, reminderType?: string) => void;
  onTriggerReminder?: (task: Task, type: '1st_reminder' | '2nd_reminder') => void;
}) {
  return (
    <div>
      {tagGroups.sortedTags.length === 0 && tagGroups.untagged.length === 0 && (
        <div
          className="tw-card"
          style={{ padding: 20, color: 'var(--tw-ink-soft)' }}
        >
          No entries match this filter.
        </div>
      )}
      {tagGroups.sortedTags.map((tag) => (
        <div key={tag} style={{ marginBottom: 22 }}>
          <div className="tw-section-title" style={{ fontSize: 15 }}>
            <TagIcon size={14} /> {tag}{' '}
            <span
              className="tw-mono"
              style={{
                fontSize: 11,
                color: 'var(--tw-ink-soft)',
                fontWeight: 400,
              }}
            >
              ({tagGroups.map[tag].length})
            </span>
          </div>
          {tagGroups.map[tag].map((t) => (
            <TaskRow
              key={t.id + '-' + tag}
              task={t}
              users={users}
              currentUser={currentUser}
              onOpen={() => onOpenTask(t.id)}
              onUpdateTask={onUpdateTask}
              highlight={isOverdue(t)}
              onOpenWhatsApp={onOpenWhatsApp}
              onTriggerReminder={onTriggerReminder}
            />
          ))}
        </div>
      ))}
      {tagGroups.untagged.length > 0 && (
        <div style={{ marginBottom: 22 }}>
          <div
            className="tw-section-title"
            style={{ fontSize: 15, color: 'var(--tw-ink-soft)' }}
          >
            <TagIcon size={14} /> Untagged{' '}
            <span
              className="tw-mono"
              style={{ fontSize: 11, fontWeight: 400 }}
            >
              ({tagGroups.untagged.length})
            </span>
          </div>
          {tagGroups.untagged.map((t) => (
            <TaskRow
              key={t.id + '-untagged'}
              task={t}
              users={users}
              currentUser={currentUser}
              onOpen={() => onOpenTask(t.id)}
              onUpdateTask={onUpdateTask}
              highlight={isOverdue(t)}
              onOpenWhatsApp={onOpenWhatsApp}
              onTriggerReminder={onTriggerReminder}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function OfficeGroupedList({
  officeGroups,
  users,
  currentUser,
  onOpenTask,
  onUpdateTask,
  onOpenWhatsApp,
  onTriggerReminder,
}: {
  officeGroups: {
    sortedOffices: string[];
    map: Record<string, Task[]>;
    unset: Task[];
  };
  users: User[];
  currentUser?: User;
  onOpenTask: (id: string) => void;
  onUpdateTask?: (updated: Task) => void;
  onOpenWhatsApp?: (task: Task, reminderType?: string) => void;
  onTriggerReminder?: (task: Task, type: '1st_reminder' | '2nd_reminder') => void;
}) {
  return (
    <div>
      {officeGroups.sortedOffices.length === 0 &&
        officeGroups.unset.length === 0 && (
          <div
            className="tw-card"
            style={{ padding: 20, color: 'var(--tw-ink-soft)' }}
          >
            No entries match this filter.
          </div>
        )}
      {officeGroups.sortedOffices.map((office) => (
        <div key={office} style={{ marginBottom: 22 }}>
          <div className="tw-section-title" style={{ fontSize: 15 }}>
            <Building2 size={14} /> {office}{' '}
            <span
              className="tw-mono"
              style={{
                fontSize: 11,
                color: 'var(--tw-ink-soft)',
                fontWeight: 400,
              }}
            >
              ({officeGroups.map[office].length})
            </span>
          </div>
          {officeGroups.map[office].map((t) => (
            <TaskRow
              key={t.id + '-' + office}
              task={t}
              users={users}
              currentUser={currentUser}
              onOpen={() => onOpenTask(t.id)}
              onUpdateTask={onUpdateTask}
              highlight={isOverdue(t)}
              onOpenWhatsApp={onOpenWhatsApp}
              onTriggerReminder={onTriggerReminder}
            />
          ))}
        </div>
      ))}
      {officeGroups.unset.length > 0 && (
        <div style={{ marginBottom: 22 }}>
          <div
            className="tw-section-title"
            style={{ fontSize: 15, color: 'var(--tw-ink-soft)' }}
          >
            <Building2 size={14} /> Not set{' '}
            <span
              className="tw-mono"
              style={{ fontSize: 11, fontWeight: 400 }}
            >
              ({officeGroups.unset.length})
            </span>
          </div>
          {officeGroups.unset.map((t) => (
            <TaskRow
              key={t.id + '-unset'}
              task={t}
              users={users}
              currentUser={currentUser}
              onOpen={() => onOpenTask(t.id)}
              onUpdateTask={onUpdateTask}
              highlight={isOverdue(t)}
              onOpenWhatsApp={onOpenWhatsApp}
              onTriggerReminder={onTriggerReminder}
            />
          ))}
        </div>
      )}
    </div>
  );
}
