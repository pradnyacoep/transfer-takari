import React from 'react';
import { Clock, AlertTriangle, AlertCircle, MessageCircle } from 'lucide-react';
import { Task } from '../types';
import { calculatePendencyInfo } from '../utils/pendencyAging';

export function PendencyBadge({
  task,
  onTriggerReminder,
  onOpenWhatsApp,
  compact = false,
}: {
  task: Task;
  onTriggerReminder?: (task: Task, type: '1st_reminder' | '2nd_reminder') => void;
  onOpenWhatsApp?: (task: Task) => void;
  compact?: boolean;
}) {
  const info = calculatePendencyInfo(task);

  if (info.tier === 'none' || !info.office) {
    return null;
  }

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        flexWrap: 'wrap',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Visual Aging Badge: Green (0-7d), Amber (8-21d), Red Pulse (21+d stalled) */}
      <span
        className={`tw-badge ${info.pulse ? 'tw-pulse-red-badge' : ''}`}
        style={{
          background: info.bg,
          color: info.color,
          border: `1px solid ${info.border}`,
          fontWeight: 600,
          fontSize: compact ? 10 : 11,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: compact ? '1.5px 6px' : '2.5px 8px',
          boxShadow: info.pulse ? '0 0 8px rgba(220,38,38,0.3)' : undefined,
          cursor: onOpenWhatsApp ? 'pointer' : 'default',
        }}
        onClick={() => onOpenWhatsApp && onOpenWhatsApp(task)}
        title={`Pendency Aging: ${info.days} days stalled at ${info.office} (${info.tierLabel}). Click to generate WhatsApp Action Memo.`}
      >
        {info.pulse ? (
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: '#DC2626',
              display: 'inline-block',
              boxShadow: '0 0 6px #EF4444',
            }}
          />
        ) : (
          <Clock size={compact ? 10 : 11} style={{ verticalAlign: '-1px' }} />
        )}
        <span>
          {info.days}d {compact ? '' : 'at'} {info.office}
        </span>
      </span>

      {/* Escalation Triggers: Past 10 days = 1st Reminder, Past 20 days = 2nd Reminder */}
      {info.reminderTrigger !== 'none' && onTriggerReminder && (
        <button
          type="button"
          className="tw-btn"
          style={{
            padding: compact ? '1px 6px' : '2px 8px',
            fontSize: compact ? 9.5 : 10.5,
            fontWeight: 700,
            borderRadius: 12,
            border: 'none',
            background:
              info.reminderTrigger === '2nd_reminder' ? '#B23A2E' : '#C77D22',
            color: '#FFFFFF',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
            lineHeight: 1.2,
          }}
          onClick={(e) => {
            e.stopPropagation();
            onTriggerReminder(task, info.reminderTrigger as '1st_reminder' | '2nd_reminder');
          }}
          title={
            info.reminderTrigger === '2nd_reminder'
              ? 'Past 20 days stalled! Click to issue pre-composed 2nd Reminder via WhatsApp.'
              : 'Past 10 days stalled! Click to issue pre-composed 1st Reminder via WhatsApp.'
          }
        >
          {info.reminderTrigger === '2nd_reminder' ? (
            <>
              <AlertCircle size={compact ? 10 : 11} /> 2nd Reminder
            </>
          ) : (
            <>
              <AlertTriangle size={compact ? 10 : 11} /> 1st Reminder
            </>
          )}
        </button>
      )}
    </div>
  );
}
