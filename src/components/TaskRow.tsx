import React, { useState, useRef, useEffect } from 'react';
import {
  Users,
  Building2,
  Bell,
  Clock,
  Calendar,
  Check,
  ChevronDown,
  Layers,
  MessageCircle,
} from 'lucide-react';
import { Task, User } from '../types';
import { STATUS_LABEL, STATUS_COLOR, PRIORITY_COLOR, STATUSES } from '../constants';
import { fmtDate, isFollowUpDue, todayISO, getFollowUpColor } from '../utils/helpers';
import { getTaskPackage, getPackageBadgeColor } from '../utils/schemePackage';
import { PendencyBadge } from './PendencyBadge';

export function TaskRow({
  task,
  users,
  currentUser,
  onOpen,
  onUpdateTask,
  highlight,
  selectable,
  selected,
  onToggleSelect,
  onOpenWhatsApp,
  onTriggerReminder,
}: {
  key?: React.Key;
  task: Task;
  users: User[];
  currentUser?: User | null;
  onOpen: () => void;
  onUpdateTask?: (task: Task) => void;
  highlight?: boolean;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (e: React.MouseEvent) => void;
  onOpenWhatsApp?: (task: Task) => void;
  onTriggerReminder?: (task: Task, type: '1st_reminder' | '2nd_reminder') => void;
}) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customDate, setCustomDate] = useState(
    task.nextFollowUpDate ? task.nextFollowUpDate.slice(0, 10) : todayISO()
  );
  const datePickerRef = useRef<HTMLDivElement>(null);
  const popoverContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showDatePicker) return;

    const handleOutsideClick = (e: MouseEvent) => {
      if (
        popoverContainerRef.current &&
        !popoverContainerRef.current.contains(e.target as Node)
      ) {
        setShowDatePicker(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowDatePicker(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showDatePicker]);

  const assigneeNames = (task.assigneeIds || [])
    .map((id) => users.find((u) => u.id === id))
    .filter(Boolean)
    .map((u) => u!.name);

  const followUpDue = isFollowUpDue(task);
  const flagged = highlight || followUpDue;
  const followUpColor = getFollowUpColor(task);

  const assignedPkg = getTaskPackage(task);
  const pkgColor = assignedPkg ? getPackageBadgeColor(assignedPkg) : null;

  // Direct status change from row
  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation();
    const newStatus = e.target.value;
    if (newStatus === task.status || !onUpdateTask) return;

    const updated: Task = {
      ...task,
      status: newStatus,
      history: [
        ...(task.history || []),
        {
          status: newStatus,
          at: new Date().toISOString(),
          by: currentUser?.id || 'usr_ee_admin',
        },
      ],
    };
    onUpdateTask(updated);
  };

  // Direct follow-up date adjustment from row
  const handleAdjustFollowUp = (daysFromToday: number | null, specificDate?: string) => {
    if (!onUpdateTask) return;

    let targetDateStr: string | null = null;
    if (daysFromToday !== null) {
      const d = new Date();
      d.setDate(d.getDate() + daysFromToday);
      targetDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`;
    } else if (specificDate) {
      targetDateStr = specificDate;
    }

    const updated: Task = {
      ...task,
      nextFollowUpDate: targetDateStr,
    };
    onUpdateTask(updated);
    setShowDatePicker(false);
  };

  return (
    <div
      className="tw-task-card"
      style={{
        ...(flagged ? { borderLeftColor: '#8B1E0F' } : {}),
        ...(selected ? { background: '#F0F4F8', borderColor: 'var(--tw-steel)' } : {}),
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        position: 'relative',
        zIndex: showDatePicker ? 45 : undefined,
      }}
      onClick={onOpen}
    >
      {selectable && (
        <div
          style={{ paddingTop: 3, cursor: 'pointer' }}
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect?.(e);
          }}
        >
          <input
            type="checkbox"
            checked={!!selected}
            onChange={() => {}}
            style={{
              width: 16,
              height: 16,
              accentColor: 'var(--tw-steel)',
              cursor: 'pointer',
            }}
          />
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <div className="tw-task-title">{task.title}</div>
            {assignedPkg && pkgColor && (
              <span
                className="tw-badge"
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  background: '#F1F5F9',
                  color: pkgColor,
                  border: `1px solid ${pkgColor}33`,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                }}
                title={`Package / Scheme: ${assignedPkg}`}
              >
                <Layers size={9} /> {assignedPkg}
              </span>
            )}
          </div>

          {/* Inline Status Selector */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ position: 'relative', flexShrink: 0 }}
          >
            <select
              className="tw-badge"
              style={{
                background: STATUS_COLOR[task.status] + '20',
                color: STATUS_COLOR[task.status],
                border: `1px solid ${STATUS_COLOR[task.status]}55`,
                fontWeight: 600,
                fontSize: 11,
                cursor: 'pointer',
                padding: '3px 20px 3px 8px',
                appearance: 'none',
                WebkitAppearance: 'none',
                outline: 'none',
                borderRadius: 12,
              }}
              value={task.status}
              onChange={handleStatusChange}
              title="Change status directly from row"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s} style={{ color: '#1E293B', background: '#FFFFFF' }}>
                  {STATUS_LABEL[s] || s}
                </option>
              ))}
            </select>
            <ChevronDown
              size={11}
              style={{
                position: 'absolute',
                right: 6,
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
                color: STATUS_COLOR[task.status],
              }}
            />
          </div>
        </div>

        <div className="tw-task-meta" style={{ flexWrap: 'wrap', gap: 10, marginTop: 6 }}>
          <span>
            <Users size={11} style={{ verticalAlign: '-2px' }} />{' '}
            {assigneeNames.length ? assigneeNames.join(', ') : 'Unassigned'}
          </span>
          <span>
            <Building2 size={11} style={{ verticalAlign: '-2px' }} />{' '}
            {(task.units || (task.unit ? [task.unit] : [])).join(', ')}
          </span>

          {/* Pendency Aging Clock & Escalation Triggers */}
          <PendencyBadge
            task={task}
            onTriggerReminder={onTriggerReminder}
            onOpenWhatsApp={onOpenWhatsApp}
            compact
          />

          {/* Interactive Next Follow-up Date pill & quick editor */}
          <div
            ref={popoverContainerRef}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              zIndex: showDatePicker ? 50 : undefined,
            }}
          >
            <button
              type="button"
              className="tw-btn tw-btn-ghost"
              style={{
                padding: '2px 7px',
                fontSize: 11.5,
                lineHeight: 1.3,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                color: followUpColor,
                background: followUpDue ? '#FDF2F1' : task.nextFollowUpDate ? '#EFF6FF' : 'transparent',
                borderColor: followUpDue ? '#F3C2BE' : task.nextFollowUpDate ? '#BFDBFE' : 'var(--tw-line)',
                borderRadius: 4,
              }}
              onClick={() => setShowDatePicker((prev) => !prev)}
              title="Click to adjust next follow-up date directly"
            >
              <Bell size={11} style={{ color: followUpColor }} />
              <span>Next follow-up:</span>
              <strong style={{ fontWeight: 700, color: followUpColor }}>
                {task.nextFollowUpDate ? fmtDate(task.nextFollowUpDate) : 'Not set'}
              </strong>
              <ChevronDown size={10} style={{ opacity: 0.7 }} />
            </button>

            {/* Quick Reschedule Popover */}
            {showDatePicker && (
              <div
                ref={datePickerRef}
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  left: 0,
                  zIndex: 100,
                  background: '#FFFFFF',
                  borderRadius: 'var(--tw-radius-sm)',
                  border: '1px solid var(--tw-steel)',
                  boxShadow: '0 10px 25px -3px rgba(0, 0, 0, 0.22), 0 4px 6px -2px rgba(0, 0, 0, 0.08)',
                  padding: 10,
                  minWidth: 236,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'var(--tw-ink)',
                    marginBottom: 6,
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>Quick Adjust Next Follow-up</span>
                  <span style={{ fontSize: 10, color: 'var(--tw-ink-soft)', fontWeight: 400 }}>
                    row shortcut
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 8 }}>
                  <button
                    type="button"
                    className="tw-btn tw-btn-ghost"
                    style={{ padding: '3px 6px', fontSize: 11 }}
                    onClick={() => handleAdjustFollowUp(0)}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    className="tw-btn tw-btn-ghost"
                    style={{ padding: '3px 6px', fontSize: 11 }}
                    onClick={() => handleAdjustFollowUp(1)}
                  >
                    Tomorrow (+1d)
                  </button>
                  <button
                    type="button"
                    className="tw-btn tw-btn-ghost"
                    style={{ padding: '3px 6px', fontSize: 11 }}
                    onClick={() => handleAdjustFollowUp(2)}
                  >
                    +2 Days
                  </button>
                  <button
                    type="button"
                    className="tw-btn tw-btn-ghost"
                    style={{ padding: '3px 6px', fontSize: 11 }}
                    onClick={() => handleAdjustFollowUp(3)}
                  >
                    +3 Days
                  </button>
                  <button
                    type="button"
                    className="tw-btn tw-btn-ghost"
                    style={{ padding: '3px 6px', fontSize: 11 }}
                    onClick={() => handleAdjustFollowUp(7)}
                  >
                    +1 Week
                  </button>
                  <button
                    type="button"
                    className="tw-btn tw-btn-ghost"
                    style={{ padding: '3px 6px', fontSize: 11, color: 'var(--tw-seal)' }}
                    onClick={() => handleAdjustFollowUp(null, '')}
                  >
                    Clear Date
                  </button>
                </div>

                <div style={{ borderTop: '1px solid var(--tw-line)', paddingTop: 6 }}>
                  <div style={{ fontSize: 10.5, color: 'var(--tw-ink-soft)', marginBottom: 3 }}>
                    Pick specific date:
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <input
                      type="date"
                      className="tw-input"
                      style={{ fontSize: 11, padding: '3px 6px', flex: 1 }}
                      value={customDate}
                      onChange={(e) => setCustomDate(e.target.value)}
                    />
                    <button
                      type="button"
                      className="tw-btn tw-btn-primary"
                      style={{ padding: '3px 8px', fontSize: 11 }}
                      onClick={() => handleAdjustFollowUp(null, customDate)}
                    >
                      <Check size={11} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 1-Click WhatsApp Action Memo */}
          <button
            type="button"
            className="tw-btn tw-btn-ghost"
            style={{
              padding: '2px 7px',
              fontSize: 11.5,
              lineHeight: 1.3,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              color: '#075E54',
              background: '#E8F5E9',
              borderColor: '#C8E6C9',
              borderRadius: 4,
              cursor: 'pointer',
            }}
            onClick={(e) => {
              e.stopPropagation();
              onOpenWhatsApp?.(task);
            }}
            title="1-Click WhatsApp Action Memo (AI generated 3-line memo)"
          >
            <MessageCircle size={12} color="#25D366" />
            <span>WhatsApp</span>
          </button>

          <span
            className="tw-badge"
            style={{
              background: PRIORITY_COLOR[task.priority] + '22',
              color: PRIORITY_COLOR[task.priority],
            }}
          >
            {task.priority}
          </span>
        </div>

        {task.deadline && (
          <div
            style={{
              fontSize: 10.5,
              color: 'var(--tw-ink-soft)',
              marginTop: 4,
            }}
          >
            <Clock size={10} style={{ verticalAlign: '-1px' }} /> Deadline:{' '}
            {fmtDate(task.deadline)}
          </div>
        )}
      </div>
    </div>
  );
}

