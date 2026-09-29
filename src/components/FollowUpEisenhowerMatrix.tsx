import React, { useState, useMemo } from 'react';
import {
  AlertOctagon,
  Calendar,
  Clock,
  Users,
  CheckSquare,
  Square,
  FastForward,
  Building2,
  Bell,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  ChevronDown,
  ChevronUp,
  Tag as TagIcon,
  HelpCircle,
} from 'lucide-react';
import { Task, User } from '../types';
import { fmtDate, fmtDateTime, isFollowUpDue, todayISO } from '../utils/helpers';
import { PRIORITY_COLOR } from '../constants';

export type MatrixQuadrant = 'Q1' | 'Q2' | 'Q3' | 'Q4';

export interface QuadrantMeta {
  key: MatrixQuadrant;
  title: string;
  shortLabel: string;
  actionTheme: string;
  subtitle: string;
  description: string;
  color: string;
  border: string;
  bg: string;
  urgencyLabel: 'Urgent' | 'Not Urgent';
  importanceLabel: 'Important' | 'Routine';
}

export const QUADRANT_CONFIGS: Record<MatrixQuadrant, QuadrantMeta> = {
  Q1: {
    key: 'Q1',
    title: 'Do First — Direct Intervention',
    shortLabel: 'Q1: Direct Action',
    actionTheme: 'Immediate Executive Action',
    subtitle: 'High / Urgent priority & Follow-up due today or overdue',
    description:
      'Critical priority files requiring immediate personal follow-up. Division Head should personally call responsible officer or convene emergency hearing.',
    color: '#B23A2E',
    border: '#F3C2BE',
    bg: '#FDF2F1',
    urgencyLabel: 'Urgent',
    importanceLabel: 'Important',
  },
  Q2: {
    key: 'Q2',
    title: 'Schedule — Strategic Monitoring',
    shortLabel: 'Q2: Strategic Cadence',
    actionTheme: 'Proactive Milestone Review',
    subtitle: 'High / Urgent priority & Follow-up scheduled in future',
    description:
      'High-impact matters on a secure trajectory. Maintain milestone reviews and advance preparation before follow-up becomes urgent.',
    color: '#2F7A4D',
    border: '#C6E7D2',
    bg: '#F1F9F4',
    urgencyLabel: 'Not Urgent',
    importanceLabel: 'Important',
  },
  Q3: {
    key: 'Q3',
    title: 'Delegate — Staff Chase',
    shortLabel: 'Q3: Staff Follow-up',
    actionTheme: 'Delegate & Dispatch Staff',
    subtitle: 'Medium / Low priority & Follow-up due today or overdue',
    description:
      'Time-sensitive intervention needed, but routine priority. Assign Section Head or staff to call field office, chase reminders, or expedite clearance.',
    color: '#C77D22',
    border: '#F7E4BE',
    bg: '#FEF9F0',
    urgencyLabel: 'Urgent',
    importanceLabel: 'Routine',
  },
  Q4: {
    key: 'Q4',
    title: 'Low Touch / Archive',
    shortLabel: 'Q4: Low Touch',
    actionTheme: 'Passive Tracking / Batch Review',
    subtitle: 'Medium / Low priority & Follow-up in future or unscheduled',
    description:
      'Routine matters requiring minimal executive attention. Review periodically in batch, or archive once finalized.',
    color: '#476579',
    border: '#CBD5E1',
    bg: '#F0F4F8',
    urgencyLabel: 'Not Urgent',
    importanceLabel: 'Routine',
  },
};

export function classifyTaskToQuadrant(task: Task, todayStr: string = todayISO()): MatrixQuadrant {
  const isImportant = task.priority === 'Urgent' || task.priority === 'High';
  // Follow-up driven urgency:
  // Urgent if nextFollowUpDate exists and is today or past
  const isUrgent = Boolean(task.nextFollowUpDate && task.nextFollowUpDate.slice(0, 10) <= todayStr);

  if (isImportant && isUrgent) return 'Q1';
  if (isImportant && !isUrgent) return 'Q2';
  if (!isImportant && isUrgent) return 'Q3';
  return 'Q4';
}

interface FollowUpEisenhowerMatrixProps {
  tasks: Task[];
  users: User[];
  today: string;
  selectedTaskIds: string[];
  toggleSelectTask: (id: string) => void;
  selectAllSection: (tasks: Task[]) => void;
  onOpenTask: (taskId: string) => void;
  onSinglePostpone: (task: Task, days: number, e: React.MouseEvent) => void;
  onSetPriority?: (task: Task, newPriority: string, e: React.MouseEvent) => void;
}

export function FollowUpEisenhowerMatrix({
  tasks,
  users,
  today,
  selectedTaskIds,
  toggleSelectTask,
  selectAllSection,
  onOpenTask,
  onSinglePostpone,
  onSetPriority,
}: FollowUpEisenhowerMatrixProps) {
  const [activeFilter, setActiveFilter] = useState<'all' | MatrixQuadrant>('all');
  const [showExplanation, setShowExplanation] = useState(true);

  // Group tasks into 4 quadrants
  const quadrantBuckets = useMemo(() => {
    const buckets: Record<MatrixQuadrant, Task[]> = {
      Q1: [],
      Q2: [],
      Q3: [],
      Q4: [],
    };
    tasks.forEach((t) => {
      const q = classifyTaskToQuadrant(t, today);
      buckets[q].push(t);
    });

    // Sort within each bucket:
    // Q1 & Q3 (urgent): earliest follow-up first
    // Q2 & Q4 (not urgent): earliest follow-up first, nulls at bottom
    (['Q1', 'Q2', 'Q3', 'Q4'] as MatrixQuadrant[]).forEach((key) => {
      buckets[key].sort((a, b) => {
        const ad = a.nextFollowUpDate || '9999-12-31';
        const bd = b.nextFollowUpDate || '9999-12-31';
        return ad.localeCompare(bd);
      });
    });

    return buckets;
  }, [tasks, today]);

  const totalCount = tasks.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Logic banner & Framework Explainer */}
      <div
        className="tw-card"
        style={{
          padding: '16px 20px',
          background: '#FFFFFF',
          borderLeft: '4px solid var(--tw-steel)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 14,
                fontWeight: 700,
                color: 'var(--tw-ink)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              <Info size={16} color="var(--tw-steel)" /> Follow-Up Driven Intervention Matrix
            </div>
            <div style={{ fontSize: 13, color: 'var(--tw-ink-soft)', marginTop: 4 }}>
              Prioritizing actions by <strong>Follow-up Intervention Timing</strong> (Urgency) and{' '}
              <strong>Administrative Priority</strong> (Importance).
            </div>
          </div>

          <button
            type="button"
            className="tw-btn tw-btn-ghost"
            style={{ fontSize: 11.5, padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
            onClick={() => setShowExplanation(!showExplanation)}
          >
            <HelpCircle size={13} />
            {showExplanation ? 'Hide Matrix Logic' : 'How this works'}
            {showExplanation ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>

        {showExplanation && (
          <div
            style={{
              marginTop: 14,
              paddingTop: 12,
              borderTop: '1px solid var(--tw-line)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 12,
              fontSize: 12,
            }}
          >
            <div
              style={{
                background: '#FDF2F1',
                border: '1px solid #F3C2BE',
                borderRadius: 'var(--tw-radius-sm)',
                padding: '8px 12px',
              }}
            >
              <div style={{ fontWeight: 700, color: '#B23A2E', display: 'flex', alignItems: 'center', gap: 5 }}>
                <AlertOctagon size={13} /> Q1: Do First (Direct Action)
              </div>
              <div style={{ color: 'var(--tw-ink)', marginTop: 3 }}>
                High/Urgent Priority &bull; Follow-up due today or overdue. Requires personal officer intervention or direct call.
              </div>
            </div>

            <div
              style={{
                background: '#F1F9F4',
                border: '1px solid #C6E7D2',
                borderRadius: 'var(--tw-radius-sm)',
                padding: '8px 12px',
              }}
            >
              <div style={{ fontWeight: 700, color: '#2F7A4D', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Calendar size={13} /> Q2: Schedule (Proactive Review)
              </div>
              <div style={{ color: 'var(--tw-ink)', marginTop: 3 }}>
                High/Urgent Priority &bull; Follow-up set for future date. Strategic files progressing on schedule.
              </div>
            </div>

            <div
              style={{
                background: '#FEF9F0',
                border: '1px solid #F7E4BE',
                borderRadius: 'var(--tw-radius-sm)',
                padding: '8px 12px',
              }}
            >
              <div style={{ fontWeight: 700, color: '#C77D22', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Users size={13} /> Q3: Delegate (Staff Chase)
              </div>
              <div style={{ color: 'var(--tw-ink)', marginTop: 3 }}>
                Medium/Low Priority &bull; Follow-up due today or overdue. Dispatch Section Head or staff to chase field office.
              </div>
            </div>

            <div
              style={{
                background: '#F0F4F8',
                border: '1px solid #CBD5E1',
                borderRadius: 'var(--tw-radius-sm)',
                padding: '8px 12px',
              }}
            >
              <div style={{ fontWeight: 700, color: '#476579', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Clock size={13} /> Q4: Low Touch / Routine
              </div>
              <div style={{ color: 'var(--tw-ink)', marginTop: 3 }}>
                Medium/Low Priority &bull; Future follow-up or pending passively. Review periodically in batch.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Filter Tabs for Quadrants */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          className={'tw-unit-tab ' + (activeFilter === 'all' ? 'active' : '')}
          style={{ fontSize: 12, padding: '5px 12px' }}
          onClick={() => setActiveFilter('all')}
        >
          All 4 Quadrants ({totalCount})
        </button>

        <button
          type="button"
          className={'tw-unit-tab ' + (activeFilter === 'Q1' ? 'active' : '')}
          style={{
            fontSize: 12,
            padding: '5px 12px',
            color: activeFilter === 'Q1' ? undefined : '#B23A2E',
            fontWeight: activeFilter === 'Q1' ? 700 : 600,
          }}
          onClick={() => setActiveFilter('Q1')}
        >
          Q1: Do First ({quadrantBuckets.Q1.length})
        </button>

        <button
          type="button"
          className={'tw-unit-tab ' + (activeFilter === 'Q2' ? 'active' : '')}
          style={{
            fontSize: 12,
            padding: '5px 12px',
            color: activeFilter === 'Q2' ? undefined : '#2F7A4D',
            fontWeight: activeFilter === 'Q2' ? 700 : 600,
          }}
          onClick={() => setActiveFilter('Q2')}
        >
          Q2: Schedule ({quadrantBuckets.Q2.length})
        </button>

        <button
          type="button"
          className={'tw-unit-tab ' + (activeFilter === 'Q3' ? 'active' : '')}
          style={{
            fontSize: 12,
            padding: '5px 12px',
            color: activeFilter === 'Q3' ? undefined : '#C77D22',
            fontWeight: activeFilter === 'Q3' ? 700 : 600,
          }}
          onClick={() => setActiveFilter('Q3')}
        >
          Q3: Delegate ({quadrantBuckets.Q3.length})
        </button>

        <button
          type="button"
          className={'tw-unit-tab ' + (activeFilter === 'Q4' ? 'active' : '')}
          style={{
            fontSize: 12,
            padding: '5px 12px',
            color: activeFilter === 'Q4' ? undefined : '#476579',
            fontWeight: activeFilter === 'Q4' ? 700 : 600,
          }}
          onClick={() => setActiveFilter('Q4')}
        >
          Q4: Low Touch ({quadrantBuckets.Q4.length})
        </button>
      </div>

      {/* Axis Guide on 2x2 Matrix */}
      {activeFilter === 'all' && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--tw-ink-soft)',
            padding: '0 4px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#B23A2E' }} />
            Column 1: Urgent Follow-Up (Due Today / Overdue)
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#2F7A4D' }} />
            Column 2: Future Follow-Up (Scheduled / Cadence)
          </div>
        </div>
      )}

      {/* 2x2 Matrix Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: activeFilter === 'all' ? 'repeat(auto-fit, minmax(460px, 1fr))' : '1fr',
          gap: 16,
        }}
      >
        {(['Q1', 'Q2', 'Q3', 'Q4'] as MatrixQuadrant[]).map((qKey) => {
          if (activeFilter !== 'all' && activeFilter !== qKey) return null;
          const config = QUADRANT_CONFIGS[qKey];
          const qTasks = quadrantBuckets[qKey];
          const allSelected =
            qTasks.length > 0 && qTasks.every((t) => selectedTaskIds.includes(t.id));

          return (
            <div
              key={qKey}
              className="tw-card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                borderLeft: `4px solid ${config.color}`,
                padding: '16px 18px',
                minHeight: 320,
                background: '#FFFFFF',
              }}
            >
              {/* Quadrant Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  borderBottom: `1px solid ${config.border}`,
                  paddingBottom: 12,
                  marginBottom: 12,
                  gap: 8,
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        background: config.bg,
                        color: config.color,
                        border: `1px solid ${config.border}`,
                        fontSize: 11,
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: 12,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {config.shortLabel}
                    </span>
                    <span
                      className="tw-display"
                      style={{ fontSize: 16, fontWeight: 700, color: config.color }}
                    >
                      {config.title}
                    </span>
                    <span
                      style={{
                        background: 'var(--tw-paper-deep)',
                        color: 'var(--tw-ink)',
                        fontSize: 11.5,
                        fontWeight: 700,
                        padding: '1px 7px',
                        borderRadius: 10,
                      }}
                    >
                      {qTasks.length}
                    </span>
                  </div>

                  <div style={{ fontSize: 11.5, color: 'var(--tw-ink-soft)', marginTop: 4 }}>
                    {config.description}
                  </div>
                </div>

                {qTasks.length > 0 && (
                  <button
                    type="button"
                    onClick={() => selectAllSection(qTasks)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--tw-ink-soft)',
                      fontSize: 11.5,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      flexShrink: 0,
                      padding: '2px 6px',
                    }}
                    title={allSelected ? 'Deselect all tasks in this quadrant' : 'Select all tasks in this quadrant'}
                  >
                    {allSelected ? <CheckSquare size={13} /> : <Square size={13} />}
                    {allSelected ? 'Deselect' : 'Select All'}
                  </button>
                )}
              </div>

              {/* Task list in quadrant */}
              {qTasks.length === 0 ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '36px 16px',
                    color: 'var(--tw-ink-soft)',
                    fontSize: 12.5,
                    fontStyle: 'italic',
                    background: config.bg + '40',
                    borderRadius: 'var(--tw-radius-sm)',
                    border: `1px dashed ${config.border}`,
                    margin: 'auto 0',
                  }}
                >
                  No tasks currently in {config.shortLabel}.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
                  {qTasks.map((task) => (
                    <MatrixTaskCard
                      key={task.id}
                      task={task}
                      quadrant={qKey}
                      isSelected={selectedTaskIds.includes(task.id)}
                      onToggleSelect={() => toggleSelectTask(task.id)}
                      onOpen={() => onOpenTask(task.id)}
                      onPostpone={onSinglePostpone}
                      onSetPriority={onSetPriority}
                      users={users}
                      today={today}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// INDIVIDUAL MATRIX TASK CARD
// -------------------------------------------------------------
interface MatrixTaskCardProps {
  key?: string;
  task: Task;
  quadrant: MatrixQuadrant;
  isSelected: boolean;
  onToggleSelect: () => void;
  onOpen: () => void;
  onPostpone: (task: Task, days: number, e: React.MouseEvent) => void;
  onSetPriority?: (task: Task, newPriority: string, e: React.MouseEvent) => void;
  users: User[];
  today: string;
}

function MatrixTaskCard({
  task,
  quadrant,
  isSelected,
  onToggleSelect,
  onOpen,
  onPostpone,
  onSetPriority,
  users,
  today,
}: MatrixTaskCardProps) {
  const assigneeNames = (task.assigneeIds || [])
    .map((id) => users.find((u) => u.id === id)?.name)
    .filter(Boolean);

  const followUpDateStr = task.nextFollowUpDate ? task.nextFollowUpDate.slice(0, 10) : null;
  const isOverdue = followUpDateStr ? followUpDateStr < today : false;
  const isToday = followUpDateStr ? followUpDateStr === today : false;

  const isHighPriority = task.priority === 'Urgent' || task.priority === 'High';

  return (
    <div
      onClick={onOpen}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: '10px 12px',
        borderRadius: 'var(--tw-radius-sm)',
        background: isSelected ? '#F0F4F8' : '#FFFFFF',
        border: `1px solid ${isSelected ? 'var(--tw-steel)' : 'var(--tw-line)'}`,
        cursor: 'pointer',
        transition: 'all 0.12s ease',
        boxShadow: isSelected ? '0 0 0 1px var(--tw-steel)' : 'var(--tw-shadow-sm)',
      }}
      onMouseEnter={(e) => {
        if (!isSelected) e.currentTarget.style.background = '#FAF9F5';
      }}
      onMouseLeave={(e) => {
        if (!isSelected) e.currentTarget.style.background = '#FFFFFF';
      }}
    >
      {/* Top row: Checkbox, ID, Priority Badge, Pending At */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect();
            }}
            style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
          >
            {isSelected ? (
              <CheckSquare size={14} color="var(--tw-steel)" />
            ) : (
              <Square size={14} color="var(--tw-ink-soft)" />
            )}
          </div>

          <span
            className="tw-mono"
            style={{ fontSize: 10.5, color: 'var(--tw-ink-soft)', fontWeight: 600 }}
          >
            #{task.id.slice(-6).toUpperCase()}
          </span>

          <span
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              padding: '1px 6px',
              borderRadius: 3,
              background: (PRIORITY_COLOR[task.priority] || '#3B6E8F') + '1A',
              color: PRIORITY_COLOR[task.priority] || '#3B6E8F',
              border: `1px solid ${(PRIORITY_COLOR[task.priority] || '#3B6E8F')}40`,
            }}
          >
            {task.priority}
          </span>
        </div>

        {/* Pending At Office / Section */}
        {task.pendingAt && (
          <span
            style={{
              fontSize: 10.5,
              color: '#6B4A12',
              background: '#FFF8E6',
              border: '1px solid #F5DEB3',
              padding: '1px 6px',
              borderRadius: 3,
              maxWidth: 180,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={`Pending At: ${task.pendingAt}`}
          >
            Pending: {task.pendingAt}
          </span>
        )}
      </div>

      {/* Task Title */}
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--tw-ink)',
          lineHeight: 1.35,
        }}
      >
        {task.title}
      </div>

      {/* Meta Row: Follow-up status, Units, Assignees */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 10,
          fontSize: 11,
          color: 'var(--tw-ink-soft)',
          marginTop: 2,
        }}
      >
        {/* Next Follow-Up Pill */}
        <span
          style={{
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '1px 6px',
            borderRadius: 3,
            background: isOverdue ? '#FDF2F1' : isToday ? '#FFFBEB' : '#F0F6FA',
            color: isOverdue ? '#8B1E0F' : isToday ? '#92400E' : '#1E40AF',
            border: `1px solid ${isOverdue ? '#F3C2BE' : isToday ? '#FDE68A' : '#BFDBFE'}`,
          }}
        >
          <Bell size={10} />
          {task.nextFollowUpDate ? (
            <span>
              Follow-up:{' '}
              <strong>
                {isOverdue
                  ? `Overdue (${fmtDate(task.nextFollowUpDate)})`
                  : isToday
                  ? 'Due Today'
                  : fmtDate(task.nextFollowUpDate)}
              </strong>
            </span>
          ) : (
            <span style={{ color: 'var(--tw-ink-soft)' }}>No Follow-up Scheduled</span>
          )}
        </span>

        {/* Units */}
        <span>
          <Building2 size={10} style={{ verticalAlign: '-1px', marginRight: 2 }} />
          {(task.units || (task.unit ? [task.unit] : [])).join(', ')}
        </span>

        {/* Assignees */}
        {assigneeNames.length > 0 && (
          <span>
            <Users size={10} style={{ verticalAlign: '-1px', marginRight: 2 }} />
            {assigneeNames.join(', ')}
          </span>
        )}
      </div>

      {/* Quick Action Footer: Reschedule & Priority adjustments */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 6,
          marginTop: 2,
          borderTop: '1px dashed var(--tw-line)',
          gap: 6,
        }}
      >
        {/* Quick Postpone buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 10.5, color: 'var(--tw-ink-soft)', marginRight: 2 }}>
            Postpone:
          </span>
          <button
            type="button"
            className="tw-btn tw-btn-ghost"
            style={{ padding: '2px 7px', fontSize: 10.5, height: 22 }}
            title="Postpone follow-up by +2 days (moves urgent task to scheduled column)"
            onClick={(e) => onPostpone(task, 2, e)}
          >
            <FastForward size={10} /> +2d
          </button>
          <button
            type="button"
            className="tw-btn tw-btn-ghost"
            style={{ padding: '2px 7px', fontSize: 10.5, height: 22 }}
            title="Postpone follow-up by +1 week"
            onClick={(e) => onPostpone(task, 7, e)}
          >
            <Calendar size={10} /> +1w
          </button>
        </div>

        {/* Quick Priority Adjuster (Moves between rows: Important <-> Routine) */}
        {onSetPriority && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {isHighPriority ? (
              <button
                type="button"
                className="tw-btn tw-btn-ghost"
                style={{
                  padding: '2px 7px',
                  fontSize: 10.5,
                  height: 22,
                  color: 'var(--tw-ink-soft)',
                }}
                title="Demote to Routine (moves to lower quadrant)"
                onClick={(e) => onSetPriority(task, 'Medium', e)}
              >
                <ArrowDownRight size={10} /> Demote to Routine
              </button>
            ) : (
              <button
                type="button"
                className="tw-btn tw-btn-ghost"
                style={{
                  padding: '2px 7px',
                  fontSize: 10.5,
                  height: 22,
                  color: '#B23A2E',
                }}
                title="Promote to High Priority (moves to upper quadrant)"
                onClick={(e) => onSetPriority(task, 'High', e)}
              >
                <ArrowUpRight size={10} /> Mark High Priority
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
