import React, { useState, useMemo, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  CalendarDays,
  Clock,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Filter,
  Search,
  CheckSquare,
  Square,
  FastForward,
  Building2,
  Users,
  Bell,
  Printer,
  Tag as TagIcon,
  ArrowRight,
  CheckCircle2,
  RefreshCw,
  X,
  PanelBottom,
  PanelRight,
  Plus,
} from 'lucide-react';
import { Task, User } from '../types';
import {
  todayISO,
  fmtDate,
  fmtDateTime,
  postponeDate,
  getFollowUpCategory,
  getFollowUpCategoryMeta,
  FollowUpCategory,
  isFieldOfficeUnit,
  allUnitsOf,
  matchesTaskSearch,
  getFollowUpColor,
  isFollowUpDue,
} from '../utils/helpers';
import { STATUS_LABEL, STATUS_COLOR, PRIORITY_COLOR, GROUP_FIELD, GROUP_DIVISION } from '../constants';
import { BatchActionBar } from './BatchActionBar';
import { BatchRescheduleModal } from './BatchRescheduleModal';
import { FollowUpEisenhowerMatrix } from './FollowUpEisenhowerMatrix';

export interface FollowUpCalendarProps {
  currentUser: User;
  tasks: Task[];
  users: User[];
  units: string[];
  unitFilter: string;
  setUnitFilter: (unit: string) => void;
  onOpenTask: (taskId: string) => void;
  onUpdateTasks: (updatedTasks: Task[]) => Promise<void>;
  onNewTask?: (initialFollowUpDate?: string) => void;
  flash: (msg: string) => void;
  initialViewMode?: ViewMode;
}

type ViewMode = 'agenda' | 'month' | 'week' | 'matrix';

export function FollowUpCalendar({
  currentUser,
  tasks,
  users,
  units,
  unitFilter,
  setUnitFilter,
  onOpenTask,
  onUpdateTasks,
  onNewTask,
  flash,
  initialViewMode,
}: FollowUpCalendarProps) {
  const today = todayISO();
  const todayDate = useMemo(() => new Date(today + 'T00:00:00'), [today]);

  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode || 'agenda');

  useEffect(() => {
    if (initialViewMode) setViewMode(initialViewMode);
  }, [initialViewMode]);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<FollowUpCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [showBatchModal, setShowBatchModal] = useState(false);

  // Month navigation state
  const [currentMonthDate, setCurrentMonthDate] = useState(() => {
    const d = new Date(today + 'T00:00:00');
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<string | null>(today);

  // Week navigation state (start of week: Monday)
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const d = new Date(today + 'T00:00:00');
    const day = d.getDay(); // 0 is Sun, 1 is Mon
    const diff = (day === 0 ? -6 : 1) - day;
    d.setDate(d.getDate() + diff);
    return d;
  });

  // Filter tasks visible by unit; completed and archived tasks vanish from calendar
  const visibleTasks = useMemo(() => {
    return tasks.filter((t) => {
      // If a task is completed or archived, it vanishes from the calendar
      if (t.status === 'COMPLETED' || t.status === 'ARCHIVED') return false;

      const taskUnits = t.units || (t.unit ? [t.unit] : []);
      if (currentUser.role === 'admin') {
        if (unitFilter === 'ALL') return true;
        if (unitFilter === GROUP_FIELD) return taskUnits.some(isFieldOfficeUnit);
        if (unitFilter === GROUP_DIVISION) return taskUnits.some((u) => !isFieldOfficeUnit(u));
        return taskUnits.includes(unitFilter);
      }
      const myUnits = allUnitsOf(currentUser);
      const inMyUnit = taskUnits.some((u) => myUnits.includes(u));
      const assignedToMe = (t.assigneeIds || []).includes(currentUser.id);
      if (!inMyUnit && !assignedToMe) return false;
      if (unitFilter === 'ALL') return true;
      if (unitFilter === GROUP_FIELD) return taskUnits.some(isFieldOfficeUnit);
      if (unitFilter === GROUP_DIVISION) return taskUnits.some((u) => !isFieldOfficeUnit(u));
      return taskUnits.includes(unitFilter);
    });
  }, [tasks, currentUser, unitFilter]);

  // Clean up selectedTaskIds if any selected task vanished (e.g. completed or archived)
  useEffect(() => {
    setSelectedTaskIds((prev) => {
      if (prev.length === 0) return prev;
      const visibleIdSet = new Set(visibleTasks.map((t) => t.id));
      const next = prev.filter((id) => visibleIdSet.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [visibleTasks]);

  // Search filtered tasks
  const searchedTasks = useMemo(() => {
    if (!searchQuery.trim()) return visibleTasks;
    return visibleTasks.filter((t) => matchesTaskSearch(t, searchQuery, users));
  }, [visibleTasks, searchQuery, users]);

  // Group tasks by category
  const categorizedTasks = useMemo(() => {
    const buckets: Record<FollowUpCategory, Task[]> = {
      overdue: [],
      today: [],
      this_week: [],
      later_this_month: [],
      future: [],
      not_set: [],
    };

    searchedTasks.forEach((t) => {
      const cat = getFollowUpCategory(t, today);
      buckets[cat].push(t);
    });

    // Sort buckets by nextFollowUpDate
    buckets.overdue.sort(
      (a, b) =>
        new Date(a.nextFollowUpDate || '').getTime() -
        new Date(b.nextFollowUpDate || '').getTime()
    );
    buckets.today.sort((a, b) => (a.priority === 'Urgent' ? -1 : 1));
    buckets.this_week.sort(
      (a, b) =>
        new Date(a.nextFollowUpDate || '').getTime() -
        new Date(b.nextFollowUpDate || '').getTime()
    );
    buckets.later_this_month.sort(
      (a, b) =>
        new Date(a.nextFollowUpDate || '').getTime() -
        new Date(b.nextFollowUpDate || '').getTime()
    );
    buckets.future.sort(
      (a, b) =>
        new Date(a.nextFollowUpDate || '').getTime() -
        new Date(b.nextFollowUpDate || '').getTime()
    );

    return buckets;
  }, [searchedTasks, today]);

  // Metric counts
  const counts = useMemo(() => {
    return {
      overdue: categorizedTasks.overdue.length,
      today: categorizedTasks.today.length,
      this_week: categorizedTasks.this_week.length,
      later_this_month: categorizedTasks.later_this_month.length,
      future: categorizedTasks.future.length,
      not_set: categorizedTasks.not_set.length,
      total: searchedTasks.length,
    };
  }, [categorizedTasks, searchedTasks]);

  // Tasks mapped by date string (YYYY-MM-DD)
  const tasksByDate = useMemo(() => {
    const map: Record<string, Task[]> = {};
    searchedTasks.forEach((t) => {
      if (!t.nextFollowUpDate) return;
      const dateKey = t.nextFollowUpDate.slice(0, 10);
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(t);
    });
    return map;
  }, [searchedTasks]);

  // Selection handlers
  const toggleSelectTask = (id: string) => {
    setSelectedTaskIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectAllSection = (sectionTasks: Task[]) => {
    const ids = sectionTasks.map((t) => t.id);
    const allSelected = ids.every((id) => selectedTaskIds.includes(id));
    if (allSelected) {
      setSelectedTaskIds((prev) => prev.filter((id) => !ids.includes(id)));
    } else {
      setSelectedTaskIds((prev) => Array.from(new Set([...prev, ...ids])));
    }
  };

  const selectAllVisible = () => {
    setSelectedTaskIds(searchedTasks.map((t) => t.id));
  };

  const deselectAll = () => {
    setSelectedTaskIds([]);
  };

  // Batch rescheduling actions
  const handleBatchPostpone = async (days: number) => {
    if (selectedTaskIds.length === 0) return;
    const updated = tasks.map((t) => {
      if (!selectedTaskIds.includes(t.id)) return t;
      const newDate = postponeDate(t.nextFollowUpDate, days);
      const noteText = `Follow-up batch postponed by +${days} day${days === 1 ? '' : 's'}`;
      const newComment = {
        id: `cm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        userId: currentUser.id,
        text: noteText,
        at: new Date().toISOString(),
      };
      return {
        ...t,
        nextFollowUpDate: newDate,
        comments: [...t.comments, newComment],
      };
    });

    await onUpdateTasks(updated);
    flash(`Rescheduled ${selectedTaskIds.length} tasks (+${days} days).`);
    deselectAll();
  };

  const handleBatchCustomApply = async (params: {
    targetDateISO: string | null;
    note?: string;
    unselectedTaskIds?: string[];
  }) => {
    const activeIds = selectedTaskIds.filter(
      (id) => !(params.unselectedTaskIds || []).includes(id)
    );
    if (activeIds.length === 0) {
      setShowBatchModal(false);
      return;
    }

    const updated = tasks.map((t) => {
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
    flash(
      params.targetDateISO
        ? `Rescheduled ${activeIds.length} tasks to ${fmtDateTime(params.targetDateISO)}.`
        : `Cleared follow-up date for ${activeIds.length} tasks.`
    );
    deselectAll();
  };

  const handleSinglePostpone = async (task: Task, days: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const newDate = postponeDate(task.nextFollowUpDate, days);
    const updated = tasks.map((t) =>
      t.id === task.id
        ? {
            ...t,
            nextFollowUpDate: newDate,
            comments: [
              ...t.comments,
              {
                id: `cm_${Date.now().toString(36)}`,
                userId: currentUser.id,
                text: `Follow-up postponed by +${days} day${days === 1 ? '' : 's'}`,
                at: new Date().toISOString(),
              },
            ],
          }
        : t
    );
    await onUpdateTasks(updated);
    flash(`Task postponed by +${days} days.`);
  };

  const handleSetPriority = async (task: Task, newPriority: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = tasks.map((t) =>
      t.id === task.id
        ? {
            ...t,
            priority: newPriority,
          }
        : t
    );
    await onUpdateTasks(updated);
    flash(`Task #${task.id.slice(-6).toUpperCase()} priority set to ${newPriority}.`);
  };

  // Month navigation helpers
  const handlePrevMonth = () => {
    setCurrentMonthDate(
      new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() - 1, 1)
    );
  };
  const handleNextMonth = () => {
    setCurrentMonthDate(
      new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 1)
    );
  };
  const handleTodayMonth = () => {
    setCurrentMonthDate(new Date(todayDate.getFullYear(), todayDate.getMonth(), 1));
    setSelectedCalendarDay(today);
  };

  // Week navigation helpers
  const handlePrevWeek = () => {
    const next = new Date(currentWeekStart);
    next.setDate(next.getDate() - 7);
    setCurrentWeekStart(next);
  };
  const handleNextWeek = () => {
    const next = new Date(currentWeekStart);
    next.setDate(next.getDate() + 7);
    setCurrentWeekStart(next);
  };
  const handleTodayWeek = () => {
    const d = new Date(today + 'T00:00:00');
    const day = d.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    d.setDate(d.getDate() + diff);
    setCurrentWeekStart(d);
  };

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto' }}>
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div>
          <div
            className="tw-display"
            style={{
              fontSize: 24,
              fontWeight: 600,
              color: 'var(--tw-ink)',
              display: 'flex',
              alignItems: 'center',
              gap: 9,
            }}
          >
            <CalendarDays size={24} color="var(--tw-steel)" /> Follow-up & Calendar Intelligence
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--tw-ink-soft)', marginTop: 2 }}>
            Division Agenda &bull; Overdue monitoring, scheduled follow-ups, and batch rescheduling
          </div>
        </div>

        {/* View Mode Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div
            style={{
              display: 'flex',
              background: 'var(--tw-paper-deep)',
              padding: 3,
              borderRadius: 'var(--tw-radius-sm)',
              border: '1px solid var(--tw-line)',
            }}
          >
            <button
              type="button"
              className={'tw-navbtn ' + (viewMode === 'agenda' ? 'active' : '')}
              style={{ padding: '6px 12px', fontSize: 12.5 }}
              onClick={() => setViewMode('agenda')}
            >
              Agenda View
            </button>
            <button
              type="button"
              className={'tw-navbtn ' + (viewMode === 'month' ? 'active' : '')}
              style={{ padding: '6px 12px', fontSize: 12.5 }}
              onClick={() => setViewMode('month')}
            >
              Month Calendar
            </button>
            <button
              type="button"
              className={'tw-navbtn ' + (viewMode === 'week' ? 'active' : '')}
              style={{ padding: '6px 12px', fontSize: 12.5 }}
              onClick={() => setViewMode('week')}
            >
              Weekly Schedule
            </button>
            <button
              type="button"
              className={'tw-navbtn ' + (viewMode === 'matrix' ? 'active' : '')}
              style={{ padding: '6px 12px', fontSize: 12.5 }}
              onClick={() => setViewMode('matrix')}
            >
              Eisenhower Matrix
            </button>
          </div>

          <button
            type="button"
            className="tw-btn tw-btn-ghost"
            style={{ padding: '6px 10px', fontSize: 12.5 }}
            onClick={() => window.print()}
            title="Print Agenda"
          >
            <Printer size={14} /> Print
          </button>
        </div>
      </div>

      {/* Color-Coded Follow-up Status Metrics Bar */}
      {viewMode !== 'matrix' && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 10,
            marginBottom: 16,
          }}
        >
        {/* Overdue */}
        <div
          className="tw-card"
          style={{
            padding: '12px 14px',
            borderLeft: '4px solid #B23A2E',
            background: activeCategoryFilter === 'overdue' ? '#FDF2F1' : '#FFFFFF',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onClick={() =>
            setActiveCategoryFilter((cur) => (cur === 'overdue' ? 'all' : 'overdue'))
          }
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: '#B23A2E',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <AlertTriangle size={12} /> Overdue
            </span>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#B23A2E',
              }}
            />
          </div>
          <div
            className="tw-display"
            style={{ fontSize: 26, fontWeight: 700, color: '#B23A2E', marginTop: 4 }}
          >
            {counts.overdue}
          </div>
          <div style={{ fontSize: 11, color: 'var(--tw-ink-soft)' }}>
            Follow-up date passed
          </div>
        </div>

        {/* Due Today */}
        <div
          className="tw-card"
          style={{
            padding: '12px 14px',
            borderLeft: '4px solid #C77D22',
            background: activeCategoryFilter === 'today' ? '#FEF8EE' : '#FFFFFF',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onClick={() =>
            setActiveCategoryFilter((cur) => (cur === 'today' ? 'all' : 'today'))
          }
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: '#C77D22',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <Clock size={12} /> Due Today
            </span>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#C77D22',
              }}
            />
          </div>
          <div
            className="tw-display"
            style={{ fontSize: 26, fontWeight: 700, color: '#C77D22', marginTop: 4 }}
          >
            {counts.today}
          </div>
          <div style={{ fontSize: 11, color: 'var(--tw-ink-soft)' }}>
            Scheduled for today
          </div>
        </div>

        {/* Due This Week */}
        <div
          className="tw-card"
          style={{
            padding: '12px 14px',
            borderLeft: '4px solid #2F7A4D',
            background: activeCategoryFilter === 'this_week' ? '#F1F9F4' : '#FFFFFF',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onClick={() =>
            setActiveCategoryFilter((cur) => (cur === 'this_week' ? 'all' : 'this_week'))
          }
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: '#2F7A4D',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <CalendarIcon size={12} /> This Week
            </span>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#2F7A4D',
              }}
            />
          </div>
          <div
            className="tw-display"
            style={{ fontSize: 26, fontWeight: 700, color: '#2F7A4D', marginTop: 4 }}
          >
            {counts.this_week}
          </div>
          <div style={{ fontSize: 11, color: 'var(--tw-ink-soft)' }}>
            Next 7 calendar days
          </div>
        </div>

        {/* Later This Month */}
        <div
          className="tw-card"
          style={{
            padding: '12px 14px',
            borderLeft: '4px solid #3B6E8F',
            background:
              activeCategoryFilter === 'later_this_month' ? '#F0F6FA' : '#FFFFFF',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onClick={() =>
            setActiveCategoryFilter((cur) =>
              cur === 'later_this_month' ? 'all' : 'later_this_month'
            )
          }
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: '#3B6E8F',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <CalendarDays size={12} /> Later This Month
            </span>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#3B6E8F',
              }}
            />
          </div>
          <div
            className="tw-display"
            style={{ fontSize: 26, fontWeight: 700, color: '#3B6E8F', marginTop: 4 }}
          >
            {counts.later_this_month}
          </div>
          <div style={{ fontSize: 11, color: 'var(--tw-ink-soft)' }}>
            Rest of September 2026
          </div>
        </div>

        {/* Future / Next Month */}
        <div
          className="tw-card"
          style={{
            padding: '12px 14px',
            borderLeft: '4px solid #52525B',
            background: activeCategoryFilter === 'future' ? '#F4F4F5' : '#FFFFFF',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onClick={() =>
            setActiveCategoryFilter((cur) => (cur === 'future' ? 'all' : 'future'))
          }
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: '#52525B',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Next Month &amp; Later
            </span>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#52525B',
              }}
            />
          </div>
          <div
            className="tw-display"
            style={{ fontSize: 26, fontWeight: 700, color: '#52525B', marginTop: 4 }}
          >
            {counts.future}
          </div>
          <div style={{ fontSize: 11, color: 'var(--tw-ink-soft)' }}>
            October 2026 onwards
          </div>
        </div>

        {/* Not Set */}
        <div
          className="tw-card"
          style={{
            padding: '12px 14px',
            borderLeft: '4px dashed #A1A1AA',
            background: activeCategoryFilter === 'not_set' ? '#FAFAFA' : '#FFFFFF',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onClick={() =>
            setActiveCategoryFilter((cur) => (cur === 'not_set' ? 'all' : 'not_set'))
          }
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: '#71717A',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Not Scheduled
            </span>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#A1A1AA',
              }}
            />
          </div>
          <div
            className="tw-display"
            style={{ fontSize: 26, fontWeight: 700, color: '#71717A', marginTop: 4 }}
          >
            {counts.not_set}
          </div>
          <div style={{ fontSize: 11, color: 'var(--tw-ink-soft)' }}>
            Pending with no date
          </div>
        </div>
      </div>
      )}

      {/* Filter and Search Bar */}
      <div
        className="tw-card"
        style={{
          padding: '10px 14px',
          marginBottom: 18,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Unit selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Filter size={13} color="var(--tw-ink-soft)" />
            <select
              className="tw-select"
              value={unitFilter}
              onChange={(e) => setUnitFilter(e.target.value)}
              style={{ fontSize: 12.5, padding: '5px 8px', width: 'auto' }}
            >
              <option value="ALL">All Units</option>
              {currentUser.role === 'admin' && (
                <>
                  <option value={GROUP_DIVISION}>Division Office (All PB/Sub-Divs)</option>
                  <option value={GROUP_FIELD}>Field Offices (All Sub-Divisions)</option>
                </>
              )}
              {units.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Category filter pills (for Agenda, Month, Week views) */}
          {viewMode !== 'matrix' && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <button
                type="button"
                className={'tw-unit-tab ' + (activeCategoryFilter === 'all' ? 'active' : '')}
                style={{ fontSize: 11.5, padding: '4px 8px' }}
                onClick={() => setActiveCategoryFilter('all')}
              >
                All ({searchedTasks.length})
              </button>
              <button
                type="button"
                className={
                  'tw-unit-tab ' + (activeCategoryFilter === 'overdue' ? 'active' : '')
                }
                style={{
                  fontSize: 11.5,
                  padding: '4px 8px',
                  color: activeCategoryFilter === 'overdue' ? undefined : '#B23A2E',
                }}
                onClick={() => setActiveCategoryFilter('overdue')}
              >
                Overdue ({counts.overdue})
              </button>
              <button
                type="button"
                className={'tw-unit-tab ' + (activeCategoryFilter === 'today' ? 'active' : '')}
                style={{
                  fontSize: 11.5,
                  padding: '4px 8px',
                  color: activeCategoryFilter === 'today' ? undefined : '#C77D22',
                }}
                onClick={() => setActiveCategoryFilter('today')}
              >
                Today ({counts.today})
              </button>
              <button
                type="button"
                className={
                  'tw-unit-tab ' + (activeCategoryFilter === 'this_week' ? 'active' : '')
                }
                style={{
                  fontSize: 11.5,
                  padding: '4px 8px',
                  color: activeCategoryFilter === 'this_week' ? undefined : '#2F7A4D',
                }}
                onClick={() => setActiveCategoryFilter('this_week')}
              >
                This Week ({counts.this_week})
              </button>
              <button
                type="button"
                className={
                  'tw-unit-tab ' +
                  (activeCategoryFilter === 'later_this_month' ? 'active' : '')
                }
                style={{
                  fontSize: 11.5,
                  padding: '4px 8px',
                  color: activeCategoryFilter === 'later_this_month' ? undefined : '#3B6E8F',
                }}
                onClick={() => setActiveCategoryFilter('later_this_month')}
              >
                This Month ({counts.later_this_month})
              </button>
              <button
                type="button"
                className={
                  'tw-unit-tab ' + (activeCategoryFilter === 'not_set' ? 'active' : '')
                }
                style={{ fontSize: 11.5, padding: '4px 8px' }}
                onClick={() => setActiveCategoryFilter('not_set')}
              >
                Not Set ({counts.not_set})
              </button>
            </div>
          )}
        </div>

        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ position: 'relative' }}>
            <Search
              size={13}
              style={{
                position: 'absolute',
                left: 9,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--tw-ink-soft)',
              }}
            />
            <input
              type="text"
              className="tw-input"
              placeholder="Search title, ID, tag…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: 28, fontSize: 12, padding: '6px 10px 6px 28px', width: 200 }}
            />
          </div>

          {/* Quick Select all visible toggle */}
          <button
            type="button"
            className="tw-btn tw-btn-ghost"
            style={{ fontSize: 11.5, padding: '6px 10px' }}
            onClick={
              selectedTaskIds.length === searchedTasks.length && searchedTasks.length > 0
                ? deselectAll
                : selectAllVisible
            }
          >
            {selectedTaskIds.length === searchedTasks.length && searchedTasks.length > 0 ? (
              <>
                <CheckSquare size={13} /> Deselect All
              </>
            ) : (
              <>
                <Square size={13} /> Select Visible ({searchedTasks.length})
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main View Area */}
      {viewMode === 'agenda' && (
        <AgendaView
          categorizedTasks={categorizedTasks}
          activeCategoryFilter={activeCategoryFilter}
          selectedTaskIds={selectedTaskIds}
          toggleSelectTask={toggleSelectTask}
          selectAllSection={selectAllSection}
          onOpenTask={onOpenTask}
          onSinglePostpone={handleSinglePostpone}
          users={users}
          today={today}
        />
      )}

      {viewMode === 'month' && (
        <MonthCalendarView
          currentMonthDate={currentMonthDate}
          tasksByDate={tasksByDate}
          selectedCalendarDay={selectedCalendarDay}
          setSelectedCalendarDay={setSelectedCalendarDay}
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
          onTodayMonth={handleTodayMonth}
          selectedTaskIds={selectedTaskIds}
          toggleSelectTask={toggleSelectTask}
          onOpenTask={onOpenTask}
          onSinglePostpone={handleSinglePostpone}
          onNewTask={onNewTask}
          users={users}
          today={today}
        />
      )}

      {viewMode === 'week' && (
        <WeeklyScheduleView
          currentWeekStart={currentWeekStart}
          tasksByDate={tasksByDate}
          onPrevWeek={handlePrevWeek}
          onNextWeek={handleNextWeek}
          onTodayWeek={handleTodayWeek}
          selectedTaskIds={selectedTaskIds}
          toggleSelectTask={toggleSelectTask}
          onOpenTask={onOpenTask}
          onSinglePostpone={handleSinglePostpone}
          onNewTask={onNewTask}
          users={users}
          today={today}
        />
      )}

      {viewMode === 'matrix' && (
        <FollowUpEisenhowerMatrix
          tasks={searchedTasks}
          users={users}
          today={today}
          selectedTaskIds={selectedTaskIds}
          toggleSelectTask={toggleSelectTask}
          selectAllSection={selectAllSection}
          onOpenTask={onOpenTask}
          onSinglePostpone={handleSinglePostpone}
          onSetPriority={handleSetPriority}
        />
      )}

      {/* Floating Batch Action Bar */}
      <BatchActionBar
        selectedCount={selectedTaskIds.length}
        totalCount={searchedTasks.length}
        onPostponeTwoDays={() => handleBatchPostpone(2)}
        onPostponeOneWeek={() => handleBatchPostpone(7)}
        onOpenCustomModal={() => setShowBatchModal(true)}
        onClearDate={async () => {
          await handleBatchCustomApply({ targetDateISO: null });
        }}
        onDeselectAll={deselectAll}
        onSelectAllVisible={selectAllVisible}
      />

      {/* Batch Custom Date Picker Modal */}
      {showBatchModal && (
        <BatchRescheduleModal
          selectedTasks={tasks.filter((t) => selectedTaskIds.includes(t.id))}
          onClose={() => setShowBatchModal(false)}
          onApply={handleBatchCustomApply}
        />
      )}
    </div>
  );
}

// -------------------------------------------------------------
// SUB-VIEW 1: AGENDA VIEW (Categorized Timeline Sections)
// -------------------------------------------------------------
function AgendaView({
  categorizedTasks,
  activeCategoryFilter,
  selectedTaskIds,
  toggleSelectTask,
  selectAllSection,
  onOpenTask,
  onSinglePostpone,
  users,
  today,
}: {
  categorizedTasks: Record<FollowUpCategory, Task[]>;
  activeCategoryFilter: FollowUpCategory | 'all';
  selectedTaskIds: string[];
  toggleSelectTask: (id: string) => void;
  selectAllSection: (tasks: Task[]) => void;
  onOpenTask: (id: string) => void;
  onSinglePostpone: (task: Task, days: number, e: React.MouseEvent) => void;
  users: User[];
  today: string;
}) {
  const sections: { key: FollowUpCategory; show: boolean }[] = [
    {
      key: 'overdue',
      show: activeCategoryFilter === 'all' || activeCategoryFilter === 'overdue',
    },
    {
      key: 'today',
      show: activeCategoryFilter === 'all' || activeCategoryFilter === 'today',
    },
    {
      key: 'this_week',
      show: activeCategoryFilter === 'all' || activeCategoryFilter === 'this_week',
    },
    {
      key: 'later_this_month',
      show: activeCategoryFilter === 'all' || activeCategoryFilter === 'later_this_month',
    },
    {
      key: 'future',
      show: activeCategoryFilter === 'all' || activeCategoryFilter === 'future',
    },
    {
      key: 'not_set',
      show: activeCategoryFilter === 'all' || activeCategoryFilter === 'not_set',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {sections.map(({ key, show }) => {
        if (!show) return null;
        const tasks = categorizedTasks[key];
        const meta = getFollowUpCategoryMeta(key);
        const allSelected =
          tasks.length > 0 && tasks.every((t) => selectedTaskIds.includes(t.id));

        return (
          <div key={key} className="tw-card" style={{ padding: '16px 20px' }}>
            {/* Section Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: 10,
                borderBottom: `2px solid ${meta.border}`,
                marginBottom: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: meta.color,
                  }}
                />
                <span
                  className="tw-display"
                  style={{ fontSize: 16, fontWeight: 700, color: meta.color }}
                >
                  {meta.label}
                </span>
                <span
                  style={{
                    background: meta.bg,
                    color: meta.color,
                    border: `1px solid ${meta.border}`,
                    fontWeight: 700,
                    fontSize: 11,
                    padding: '1px 8px',
                    borderRadius: 12,
                  }}
                >
                  {tasks.length}
                </span>
              </div>

              {tasks.length > 0 && (
                <button
                  type="button"
                  onClick={() => selectAllSection(tasks)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--tw-ink-soft)',
                    fontSize: 12,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  {allSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                  {allSelected ? 'Deselect Section' : 'Select Section'}
                </button>
              )}
            </div>

            {/* Task list in this section */}
            {tasks.length === 0 ? (
              <div
                style={{
                  padding: '12px 0',
                  color: 'var(--tw-ink-soft)',
                  fontSize: 13,
                  fontStyle: 'italic',
                }}
              >
                No tasks in this category.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {tasks.map((task) => (
                  <AgendaTaskRow
                    key={task.id}
                    task={task}
                    isSelected={selectedTaskIds.includes(task.id)}
                    onToggleSelect={() => toggleSelectTask(task.id)}
                    onOpen={() => onOpenTask(task.id)}
                    onPostpone={onSinglePostpone}
                    users={users}
                    meta={meta}
                    today={today}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function AgendaTaskRow({
  task,
  isSelected,
  onToggleSelect,
  onOpen,
  onPostpone,
  users,
  meta,
  today,
}: {
  key?: React.Key;
  task: Task;
  isSelected: boolean;
  onToggleSelect: () => void;
  onOpen: () => void;
  onPostpone: (task: Task, days: number, e: React.MouseEvent) => void;
  users: User[];
  meta: ReturnType<typeof getFollowUpCategoryMeta>;
  today: string;
}) {
  const assigneeNames = (task.assigneeIds || [])
    .map((id) => users.find((u) => u.id === id)?.name)
    .filter(Boolean);

  const isOverdue =
    task.nextFollowUpDate && task.nextFollowUpDate.slice(0, 10) < today;

  return (
    <div
      onClick={onOpen}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '10px 14px',
        borderRadius: 'var(--tw-radius-sm)',
        background: isSelected ? '#F0F4F8' : '#FFFFFF',
        border: `1px solid ${isSelected ? 'var(--tw-steel)' : 'var(--tw-line)'}`,
        borderLeft: `4px solid ${meta.color}`,
        cursor: 'pointer',
        transition: 'all 0.12s ease',
      }}
      onMouseEnter={(e) => {
        if (!isSelected) e.currentTarget.style.background = '#FAF9F5';
      }}
      onMouseLeave={(e) => {
        if (!isSelected) e.currentTarget.style.background = '#FFFFFF';
      }}
    >
      {/* Checkbox */}
      <div
        style={{ paddingTop: 3 }}
        onClick={(e) => {
          e.stopPropagation();
          onToggleSelect();
        }}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => {}}
          style={{
            width: 16,
            height: 16,
            accentColor: 'var(--tw-steel)',
            cursor: 'pointer',
          }}
        />
      </div>

      {/* Task Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              className="tw-mono"
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--tw-steel)',
                background: 'var(--tw-paper-deep)',
                padding: '1px 6px',
                borderRadius: 4,
              }}
            >
              #{task.id.replace('tsk_', '').toUpperCase()}
            </span>
            <span
              style={{
                fontSize: 13.5,
                fontWeight: 600,
                color: 'var(--tw-ink)',
              }}
            >
              {task.title}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              className="tw-badge"
              style={{
                background: PRIORITY_COLOR[task.priority] + '22',
                color: PRIORITY_COLOR[task.priority],
                fontSize: 10.5,
              }}
            >
              {task.priority}
            </span>
            <span
              className="tw-badge"
              style={{
                background: STATUS_COLOR[task.status] + '22',
                color: STATUS_COLOR[task.status],
                fontSize: 10.5,
              }}
            >
              {STATUS_LABEL[task.status]}
            </span>
          </div>
        </div>

        {/* Meta row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            fontSize: 11.5,
            color: 'var(--tw-ink-soft)',
            marginTop: 5,
            flexWrap: 'wrap',
          }}
        >
          <span>
            <Building2 size={11} style={{ verticalAlign: '-1px' }} />{' '}
            {(task.units || (task.unit ? [task.unit] : [])).join(', ')}
          </span>

          <span>
            <Users size={11} style={{ verticalAlign: '-1px' }} />{' '}
            {assigneeNames.length ? assigneeNames.join(', ') : 'Unassigned'}
          </span>

          <span
            style={{
              fontWeight: 700,
              color: isFollowUpDue(task) ? '#8B1E0F' : '#1D4ED8',
              background: isFollowUpDue(task) ? '#FDF2F1' : '#EFF6FF',
              padding: '1px 7px',
              borderRadius: 4,
              border: `1px solid ${isFollowUpDue(task) ? '#F3C2BE' : '#BFDBFE'}`,
            }}
          >
            <Bell size={11} style={{ verticalAlign: '-1px' }} /> Next follow-up:{' '}
            <strong style={{ fontWeight: 700 }}>
              {task.nextFollowUpDate ? fmtDateTime(task.nextFollowUpDate) : 'Not scheduled'}
            </strong>
          </span>

          {task.deadline && (
            <span>
              <Clock size={11} style={{ verticalAlign: '-1px' }} /> Deadline:{' '}
              {fmtDate(task.deadline)}
            </span>
          )}
        </div>
      </div>

      {/* Quick Action buttons */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          flexShrink: 0,
          paddingTop: 2,
        }}
      >
        <button
          type="button"
          className="tw-btn tw-btn-ghost"
          style={{ padding: '4px 8px', fontSize: 11 }}
          title="Postpone by 2 days"
          onClick={(e) => onPostpone(task, 2, e)}
        >
          <FastForward size={11} /> +2d
        </button>
        <button
          type="button"
          className="tw-btn tw-btn-ghost"
          style={{ padding: '4px 8px', fontSize: 11 }}
          title="Postpone by 1 week"
          onClick={(e) => onPostpone(task, 7, e)}
        >
          <CalendarIcon size={11} /> +1w
        </button>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// SUB-VIEW 2: MONTHLY CALENDAR GRID VIEW
// -------------------------------------------------------------
function MonthCalendarView({
  currentMonthDate,
  tasksByDate,
  selectedCalendarDay,
  setSelectedCalendarDay,
  onPrevMonth,
  onNextMonth,
  onTodayMonth,
  selectedTaskIds,
  toggleSelectTask,
  onOpenTask,
  onSinglePostpone,
  onNewTask,
  users,
  today,
}: {
  currentMonthDate: Date;
  tasksByDate: Record<string, Task[]>;
  selectedCalendarDay: string | null;
  setSelectedCalendarDay: (d: string | null) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onTodayMonth: () => void;
  selectedTaskIds: string[];
  toggleSelectTask: (id: string) => void;
  onOpenTask: (id: string) => void;
  onSinglePostpone: (task: Task, days: number, e: React.MouseEvent) => void;
  onNewTask?: (dateStr?: string) => void;
  users: User[];
  today: string;
}) {
  const monthYearStr = currentMonthDate.toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });

  // Calculate calendar grid days
  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 is Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const days: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];

  // Previous month padding
  const prevMonthDays = new Date(year, month, 0).getDate();
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    const prevM = month === 0 ? 12 : month;
    const prevY = month === 0 ? year - 1 : year;
    days.push({
      dateStr: `${prevY}-${String(prevM).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      dayNum: d,
      isCurrentMonth: false,
    });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    days.push({
      dateStr: `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      dayNum: d,
      isCurrentMonth: true,
    });
  }

  // Next month padding to fill complete weeks (up to 35 or 42 cells)
  const remaining = (7 - (days.length % 7)) % 7;
  for (let d = 1; d <= remaining; d++) {
    const nextM = month === 11 ? 1 : month + 2;
    const nextY = month === 11 ? year + 1 : year;
    days.push({
      dateStr: `${nextY}-${String(nextM).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      dayNum: d,
      isCurrentMonth: false,
    });
  }

  const selectedDayTasks = selectedCalendarDay ? tasksByDate[selectedCalendarDay] || [] : [];

  // Default to 'bottom' layout on standard/preview screens to prevent overlap, 'side' on extra-wide monitors
  const [panelLayout, setPanelLayout] = useState<'bottom' | 'side'>(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 1350) {
      return 'side';
    }
    return 'bottom';
  });
  const [isDayPanelOpen, setIsDayPanelOpen] = useState(true);

  const isSideLayout = panelLayout === 'side' && isDayPanelOpen;

  // Reusable day tasks list component
  const renderDayTasksList = (inSideDrawer: boolean) => (
    <div
      className="tw-card"
      style={{
        padding: inSideDrawer ? 16 : 18,
        minWidth: 0,
        width: inSideDrawer ? 340 : '100%',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          borderBottom: '1px solid var(--tw-line)',
          paddingBottom: 10,
          marginBottom: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span
              className="tw-display"
              style={{ fontSize: inSideDrawer ? 16 : 17, fontWeight: 700, color: 'var(--tw-ink)' }}
            >
              {selectedCalendarDay ? fmtDate(selectedCalendarDay) : 'Select a date'}
            </span>
            {selectedCalendarDay && selectedCalendarDay < today ? (
              <span
                className="tw-badge"
                style={{
                  background: '#FDF2F1',
                  color: '#B23A2E',
                  border: '1px solid #F3C2BE',
                  fontSize: 10.5,
                }}
              >
                Overdue
              </span>
            ) : selectedCalendarDay === today ? (
              <span
                className="tw-badge"
                style={{
                  background: '#FEF8EE',
                  color: '#C77D22',
                  border: '1px solid #F6DFB8',
                  fontSize: 10.5,
                }}
              >
                Due Today
              </span>
            ) : null}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--tw-ink-soft)', marginTop: 2 }}>
            {selectedDayTasks.length} task{selectedDayTasks.length === 1 ? '' : 's'} scheduled for follow-up
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {onNewTask && selectedCalendarDay && (
            <button
              type="button"
              className="tw-btn tw-btn-primary"
              style={{
                padding: '4px 9px',
                fontSize: 11.5,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
              onClick={() => onNewTask(selectedCalendarDay)}
              title={`Allocate task with follow-up on ${fmtDate(selectedCalendarDay)}`}
            >
              <Plus size={13} /> Add Task
            </button>
          )}
          <button
            type="button"
            className="tw-btn tw-btn-ghost"
            style={{ padding: '4px 8px', fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 4 }}
            onClick={() => setPanelLayout(inSideDrawer ? 'bottom' : 'side')}
            title={inSideDrawer ? 'Move day tasks below calendar' : 'Dock day tasks to side panel'}
          >
            {inSideDrawer ? <PanelBottom size={13} /> : <PanelRight size={13} />}
            <span>{inSideDrawer ? 'Below' : 'Side'}</span>
          </button>
          <button
            type="button"
            className="tw-btn tw-btn-ghost"
            style={{ padding: '4px 6px' }}
            onClick={() => setIsDayPanelOpen(false)}
            title="Close day tasks panel"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {selectedDayTasks.length === 0 ? (
        <div
          style={{
            padding: '24px 0',
            textAlign: 'center',
            color: 'var(--tw-ink-soft)',
            fontSize: 12.5,
          }}
        >
          <div>No follow-ups scheduled on this date. Click any date on the calendar to inspect its tasks.</div>
          {onNewTask && selectedCalendarDay && (
            <div style={{ marginTop: 10 }}>
              <button
                type="button"
                className="tw-btn tw-btn-ghost"
                style={{
                  fontSize: 12,
                  padding: '5px 12px',
                  color: '#1D4ED8',
                  border: '1px dashed #BFDBFE',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                }}
                onClick={() => onNewTask(selectedCalendarDay)}
              >
                <Plus size={13} /> Allocate a task for this date
              </button>
            </div>
          )}
        </div>
      ) : inSideDrawer ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 520, overflowY: 'auto' }}>
          {selectedDayTasks.map((t) => (
            <div
              key={t.id}
              onClick={() => onOpenTask(t.id)}
              style={{
                padding: '9px 11px',
                borderRadius: 'var(--tw-radius-sm)',
                border: '1px solid var(--tw-line)',
                background: selectedTaskIds.includes(t.id) ? '#F0F4F8' : '#FFFFFF',
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 6,
                }}
              >
                <div
                  style={{
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: 'var(--tw-ink)',
                    lineHeight: 1.35,
                  }}
                >
                  {t.title}
                </div>
                <span
                  className="tw-badge"
                  style={{
                    background: PRIORITY_COLOR[t.priority] + '22',
                    color: PRIORITY_COLOR[t.priority],
                    fontSize: 9.5,
                    flexShrink: 0,
                  }}
                >
                  {t.priority}
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: 6,
                  fontSize: 11,
                  color: 'var(--tw-ink-soft)',
                }}
              >
                <span>
                  <Building2 size={10} /> {(t.units || []).join(', ') || 'Division'}
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    type="button"
                    className="tw-btn tw-btn-ghost"
                    style={{ padding: '2px 6px', fontSize: 10.5 }}
                    onClick={(e) => onSinglePostpone(t, 2, e)}
                    title="Postpone +2 days"
                  >
                    +2d
                  </button>
                  <button
                    type="button"
                    className="tw-btn tw-btn-ghost"
                    style={{ padding: '2px 6px', fontSize: 10.5 }}
                    onClick={(e) => onSinglePostpone(t, 7, e)}
                    title="Postpone +1 week"
                  >
                    +1w
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 10,
          }}
        >
          {selectedDayTasks.map((t) => (
            <div
              key={t.id}
              onClick={() => onOpenTask(t.id)}
              style={{
                padding: '11px 13px',
                borderRadius: 'var(--tw-radius-sm)',
                border: '1px solid var(--tw-line)',
                background: selectedTaskIds.includes(t.id) ? '#F0F4F8' : '#FFFFFF',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 8,
                transition: 'all 0.15s ease',
              }}
            >
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 8,
                    marginBottom: 4,
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--tw-ink)',
                      lineHeight: 1.35,
                    }}
                  >
                    {t.title}
                  </div>
                  <span
                    className="tw-badge"
                    style={{
                      background: PRIORITY_COLOR[t.priority] + '22',
                      color: PRIORITY_COLOR[t.priority],
                      fontSize: 9.5,
                      flexShrink: 0,
                    }}
                  >
                    {t.priority}
                  </span>
                </div>

                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--tw-ink-soft)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Building2 size={11} /> {(t.units || []).join(', ') || 'Division Office'}
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: 8,
                  borderTop: '1px solid var(--tw-line)',
                  fontSize: 11,
                }}
              >
                <span style={{ color: 'var(--tw-ink-soft)' }}>
                  Status: <strong style={{ color: 'var(--tw-ink)' }}>{STATUS_LABEL[t.status]}</strong>
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    type="button"
                    className="tw-btn tw-btn-ghost"
                    style={{ padding: '2px 7px', fontSize: 10.5 }}
                    onClick={(e) => onSinglePostpone(t, 2, e)}
                    title="Postpone +2 days"
                  >
                    +2d
                  </button>
                  <button
                    type="button"
                    className="tw-btn tw-btn-ghost"
                    style={{ padding: '2px 7px', fontSize: 10.5 }}
                    onClick={(e) => onSinglePostpone(t, 7, e)}
                    title="Postpone +1 week"
                  >
                    +1w
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div
      style={{
        display: isSideLayout ? 'grid' : 'flex',
        flexDirection: isSideLayout ? undefined : 'column',
        gridTemplateColumns: isSideLayout ? 'minmax(0, 1fr) 340px' : undefined,
        gap: 16,
        alignItems: 'start',
        minWidth: 0,
      }}
    >
      {/* Calendar Grid Box */}
      <div
        className="tw-card"
        style={{
          padding: 18,
          minWidth: 0,
          width: '100%',
          overflow: 'hidden',
        }}
      >
        {/* Navigation header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 14,
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <div
            className="tw-display"
            style={{ fontSize: 18, fontWeight: 700, color: 'var(--tw-ink)' }}
          >
            {monthYearStr}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="tw-btn tw-btn-ghost"
              style={{ padding: '5px 8px' }}
              onClick={onPrevMonth}
              title="Previous Month"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              className="tw-btn tw-btn-ghost"
              style={{ padding: '5px 12px', fontSize: 12 }}
              onClick={onTodayMonth}
            >
              Today
            </button>
            <button
              type="button"
              className="tw-btn tw-btn-ghost"
              style={{ padding: '5px 8px' }}
              onClick={onNextMonth}
              title="Next Month"
            >
              <ChevronRight size={16} />
            </button>

            {/* Layout Switcher (Bottom vs Side) */}
            <button
              type="button"
              className="tw-btn tw-btn-ghost"
              style={{ padding: '5px 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}
              onClick={() => {
                setPanelLayout((prev) => (prev === 'side' ? 'bottom' : 'side'));
                setIsDayPanelOpen(true);
              }}
              title={panelLayout === 'side' ? 'Switch day details to bottom view' : 'Switch day details to side view'}
            >
              {panelLayout === 'side' ? <PanelBottom size={14} /> : <PanelRight size={14} />}
              <span>{panelLayout === 'side' ? 'Bottom View' : 'Side View'}</span>
            </button>

            {/* Day tasks visibility toggle */}
            <button
              type="button"
              className={`tw-btn ${isDayPanelOpen ? 'tw-btn-ghost' : 'tw-btn-primary'}`}
              style={{ padding: '5px 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}
              onClick={() => setIsDayPanelOpen((prev) => !prev)}
              title={isDayPanelOpen ? 'Hide specific day task details' : 'Show specific day task details'}
            >
              <CalendarIcon size={13} />
              <span>{isDayPanelOpen ? 'Hide Details' : `Day Details (${selectedDayTasks.length})`}</span>
            </button>
          </div>
        </div>

        {/* Days of week */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
            gap: 4,
            marginBottom: 6,
            textAlign: 'center',
            minWidth: 0,
          }}
        >
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((dw, i) => (
            <div
              key={dw}
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: i === 0 ? 'var(--tw-seal)' : 'var(--tw-ink-soft)',
                textTransform: 'uppercase',
                padding: '4px 0',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {dw}
            </div>
          ))}
        </div>

        {/* Grid Cells */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
            gap: 5,
            minWidth: 0,
          }}
        >
          {days.map((item) => {
            const dayTasks = tasksByDate[item.dateStr] || [];
            const isToday = item.dateStr === today;
            const isSelected = item.dateStr === selectedCalendarDay && isDayPanelOpen;
            const hasOverdue = item.dateStr < today && dayTasks.length > 0;
            const isDueToday = item.dateStr === today && dayTasks.length > 0;

            return (
              <div
                key={item.dateStr}
                onClick={() => {
                  setSelectedCalendarDay(item.dateStr);
                  setIsDayPanelOpen(true);
                }}
                style={{
                  minHeight: 82,
                  minWidth: 0,
                  padding: 6,
                  borderRadius: 'var(--tw-radius-sm)',
                  background: isSelected
                    ? '#F0F4F8'
                    : item.isCurrentMonth
                    ? '#FFFFFF'
                    : '#FAFAFA',
                  border: `1px solid ${
                    isSelected
                      ? 'var(--tw-steel)'
                      : isToday
                      ? 'var(--tw-gold)'
                      : 'var(--tw-line)'
                  }`,
                  cursor: 'pointer',
                  opacity: item.isCurrentMonth ? 1 : 0.45,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  transition: 'all 0.12s ease',
                }}
              >
                {/* Date header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 3,
                    minWidth: 0,
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: isToday ? 700 : 500,
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: isToday ? 'var(--tw-ink)' : 'transparent',
                      color: isToday ? '#FFFFFF' : 'var(--tw-ink)',
                      flexShrink: 0,
                    }}
                  >
                    {item.dayNum}
                  </span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                    {dayTasks.length > 0 && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '1px 5px',
                          borderRadius: 10,
                          background: hasOverdue
                            ? '#FDF2F1'
                            : isDueToday
                            ? '#FEF8EE'
                            : '#F1F9F4',
                          color: hasOverdue
                            ? '#B23A2E'
                            : isDueToday
                            ? '#C77D22'
                            : '#2F7A4D',
                          border: `1px solid ${
                            hasOverdue
                              ? '#F3C2BE'
                              : isDueToday
                              ? '#F6DFB8'
                              : '#C2E6D0'
                          }`,
                        }}
                      >
                        {dayTasks.length}
                      </span>
                    )}

                    {onNewTask && (
                      <button
                        type="button"
                        className="tw-btn tw-btn-ghost"
                        style={{
                          padding: '0 4px',
                          height: 18,
                          fontSize: 9.5,
                          fontWeight: 700,
                          borderRadius: 3,
                          background: '#EFF6FF',
                          color: '#1D4ED8',
                          border: '1px solid #BFDBFE',
                          lineHeight: 1,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 1,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onNewTask(item.dateStr);
                        }}
                        title={`Allocate task with follow-up on ${fmtDate(item.dateStr)}`}
                      >
                        <Plus size={8} /> Add
                      </button>
                    )}
                  </div>
                </div>

                {/* Task preview dots / chips */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden', minWidth: 0 }}>
                  {dayTasks.slice(0, 2).map((t) => (
                    <div
                      key={t.id}
                      style={{
                        fontSize: 10,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        padding: '1px 4px',
                        borderRadius: 3,
                        minWidth: 0,
                        maxWidth: '100%',
                        background:
                          hasOverdue
                            ? 'rgba(178,58,46,0.1)'
                            : isDueToday
                            ? 'rgba(199,125,34,0.1)'
                            : 'rgba(47,122,77,0.1)',
                        color:
                          hasOverdue
                            ? '#B23A2E'
                            : isDueToday
                            ? '#C77D22'
                            : '#2F7A4D',
                      }}
                      title={t.title}
                    >
                      {t.title}
                    </div>
                  ))}
                  {dayTasks.length > 2 && (
                    <div style={{ fontSize: 9.5, color: 'var(--tw-ink-soft)', paddingLeft: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      +{dayTasks.length - 2} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Day Agenda Drawer (Rendered as Side Column if side layout) */}
      {isSideLayout && renderDayTasksList(true)}

      {/* Selected Day Agenda Section (Rendered below Calendar if bottom layout) */}
      {!isSideLayout && isDayPanelOpen && renderDayTasksList(false)}
    </div>
  );
}

// -------------------------------------------------------------
// SUB-VIEW 3: WEEKLY SCHEDULE VIEW (7-Day Column Cards)
// -------------------------------------------------------------
function WeeklyScheduleView({
  currentWeekStart,
  tasksByDate,
  onPrevWeek,
  onNextWeek,
  onTodayWeek,
  selectedTaskIds,
  toggleSelectTask,
  onOpenTask,
  onSinglePostpone,
  onNewTask,
  users,
  today,
}: {
  currentWeekStart: Date;
  tasksByDate: Record<string, Task[]>;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onTodayWeek: () => void;
  selectedTaskIds: string[];
  toggleSelectTask: (id: string) => void;
  onOpenTask: (id: string) => void;
  onSinglePostpone: (task: Task, days: number, e: React.MouseEvent) => void;
  onNewTask?: (dateStr?: string) => void;
  users: User[];
  today: string;
}) {
  const weekDays = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() + i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;
    return {
      date: d,
      dateStr,
      dayName: d.toLocaleDateString('en-IN', { weekday: 'short' }),
      dayNum: d.getDate(),
      monthName: d.toLocaleDateString('en-IN', { month: 'short' }),
      isToday: dateStr === today,
      isOverdue: dateStr < today,
    };
  });

  const rangeLabel = `${weekDays[0].dayNum} ${weekDays[0].monthName} – ${
    weekDays[6].dayNum
  } ${weekDays[6].monthName} ${weekDays[6].date.getFullYear()}`;

  return (
    <div className="tw-card" style={{ padding: 18 }}>
      {/* Week navigation header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div>
          <div
            className="tw-display"
            style={{ fontSize: 18, fontWeight: 700, color: 'var(--tw-ink)' }}
          >
            Weekly Schedule &bull; {rangeLabel}
          </div>
          <div style={{ fontSize: 12, color: 'var(--tw-ink-soft)' }}>
            7-day operational timeline of pending follow-up deadlines
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            type="button"
            className="tw-btn tw-btn-ghost"
            style={{ padding: '6px 10px', fontSize: 12 }}
            onClick={onPrevWeek}
          >
            <ChevronLeft size={14} /> Previous Week
          </button>
          <button
            type="button"
            className="tw-btn tw-btn-ghost"
            style={{ padding: '6px 12px', fontSize: 12 }}
            onClick={onTodayWeek}
          >
            This Week
          </button>
          <button
            type="button"
            className="tw-btn tw-btn-ghost"
            style={{ padding: '6px 10px', fontSize: 12 }}
            onClick={onNextWeek}
          >
            Next Week <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* 7 Columns Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 10,
        }}
      >
        {weekDays.map((col) => {
          const colTasks = tasksByDate[col.dateStr] || [];

          return (
            <div
              key={col.dateStr}
              style={{
                background: col.isToday
                  ? '#FEF8EE'
                  : col.isOverdue
                  ? '#FDF2F1'
                  : '#FAFAFA',
                border: `1px solid ${
                  col.isToday
                    ? 'var(--tw-gold)'
                    : col.isOverdue
                    ? '#F3C2BE'
                    : 'var(--tw-line)'
                }`,
                borderRadius: 'var(--tw-radius-sm)',
                padding: 10,
                display: 'flex',
                flexDirection: 'column',
                minHeight: 320,
              }}
            >
              {/* Column Day Header */}
              <div
                style={{
                  borderBottom: '1px solid var(--tw-line)',
                  paddingBottom: 8,
                  marginBottom: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      color: col.isToday
                        ? 'var(--tw-gold)'
                        : col.isOverdue
                        ? 'var(--tw-seal)'
                        : 'var(--tw-ink-soft)',
                    }}
                  >
                    {col.dayName}
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: 'var(--tw-ink)',
                    }}
                  >
                    {col.dayNum} {col.monthName}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '1px 6px',
                      borderRadius: 10,
                      background: colTasks.length ? '#FFFFFF' : 'transparent',
                      border: colTasks.length ? '1px solid var(--tw-line)' : 'none',
                      color: 'var(--tw-ink)',
                    }}
                  >
                    {colTasks.length}
                  </span>

                  {onNewTask && (
                    <button
                      type="button"
                      className="tw-btn tw-btn-ghost"
                      style={{
                        padding: '1px 5px',
                        height: 20,
                        fontSize: 10,
                        fontWeight: 700,
                        borderRadius: 3,
                        background: '#EFF6FF',
                        color: '#1D4ED8',
                        border: '1px solid #BFDBFE',
                        lineHeight: 1,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 2,
                      }}
                      onClick={() => onNewTask(col.dateStr)}
                      title={`Allocate task with follow-up on ${fmtDate(col.dateStr)}`}
                    >
                      <Plus size={9} /> Add
                    </button>
                  )}
                </div>
              </div>

              {/* Tasks */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                {colTasks.length === 0 ? (
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--tw-ink-soft)',
                      fontStyle: 'italic',
                      padding: '8px 2px',
                    }}
                  >
                    None
                  </div>
                ) : (
                  colTasks.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => onOpenTask(t.id)}
                      style={{
                        padding: '7px 9px',
                        background: '#FFFFFF',
                        border: '1px solid var(--tw-line)',
                        borderRadius: 4,
                        fontSize: 11.5,
                        cursor: 'pointer',
                        boxShadow: 'var(--tw-shadow-sm)',
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 600,
                          color: 'var(--tw-ink)',
                          marginBottom: 4,
                        }}
                      >
                        {t.title}
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: 10,
                          color: 'var(--tw-ink-soft)',
                        }}
                      >
                        <span
                          className="tw-badge"
                          style={{
                            background: PRIORITY_COLOR[t.priority] + '22',
                            color: PRIORITY_COLOR[t.priority],
                            padding: '1px 4px',
                            fontSize: 9,
                          }}
                        >
                          {t.priority}
                        </span>
                        <button
                          type="button"
                          className="tw-btn tw-btn-ghost"
                          style={{ padding: '1px 4px', fontSize: 10 }}
                          onClick={(e) => onSinglePostpone(t, 2, e)}
                          title="Postpone by 2 days"
                        >
                          +2d
                        </button>
                      </div>
                    </div>
                  ))
                )}

                {onNewTask && (
                  <button
                    type="button"
                    className="tw-btn tw-btn-ghost"
                    style={{
                      marginTop: 'auto',
                      padding: '5px 6px',
                      fontSize: 11,
                      fontWeight: 600,
                      color: '#1D4ED8',
                      background: '#FFFFFF',
                      border: '1px dashed #BFDBFE',
                      borderRadius: 4,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      width: '100%',
                    }}
                    onClick={() => onNewTask(col.dateStr)}
                    title={`Allocate task with next follow-up on ${fmtDate(col.dateStr)}`}
                  >
                    <Plus size={12} /> Add
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
