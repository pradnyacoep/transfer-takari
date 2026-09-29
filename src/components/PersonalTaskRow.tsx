import React from 'react';
import { Users, Bell, Clock } from 'lucide-react';
import { PersonalTask } from '../types';
import { PERSONAL_STATUS_LABEL, PERSONAL_STATUS_COLOR, PRIORITY_COLOR } from '../constants';
import { fmtDate, isPersonalFollowUpDue } from '../utils/helpers';

export function PersonalTaskRow({
  task,
  onOpen,
}: {
  key?: React.Key;
  task: PersonalTask;
  onOpen: () => void;
}) {
  const due = isPersonalFollowUpDue(task);

  return (
    <div
      className="tw-task-card"
      style={due ? { borderLeftColor: 'var(--tw-seal)' } : {}}
      onClick={onOpen}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <div className="tw-task-title">{task.title}</div>
        <span
          className="tw-badge"
          style={{
            background: (PERSONAL_STATUS_COLOR[task.status] || '#8a8478') + '22',
            color: PERSONAL_STATUS_COLOR[task.status] || '#8a8478',
          }}
        >
          {PERSONAL_STATUS_LABEL[task.status] || task.status}
        </span>
      </div>

      <div className="tw-task-meta">
        <span>
          <Users size={11} style={{ verticalAlign: '-2px' }} />{' '}
          {task.assignedTo || 'Myself'}
        </span>
        <span
          style={{
            color: task.nextFollowUpDate ? (due ? '#8B1E0F' : '#1D4ED8') : 'var(--tw-ink-soft)',
            fontWeight: 700,
          }}
        >
          <Bell size={11} style={{ verticalAlign: '-2px' }} /> Next follow-up:{' '}
          <strong style={{ fontWeight: 700 }}>
            {task.nextFollowUpDate ? fmtDate(task.nextFollowUpDate) : 'Not set'}
          </strong>
        </span>
        {task.priority && (
          <span
            className="tw-badge"
            style={{
              background: (PRIORITY_COLOR[task.priority] || '#3B6E8F') + '22',
              color: PRIORITY_COLOR[task.priority] || '#3B6E8F',
            }}
          >
            {task.priority}
          </span>
        )}
      </div>

      {task.dueDate && (
        <div
          style={{
            fontSize: 10.5,
            color: 'var(--tw-ink-soft)',
            marginTop: 4,
          }}
        >
          <Clock size={10} style={{ verticalAlign: '-1px' }} /> Due:{' '}
          {fmtDate(task.dueDate)}
        </div>
      )}
    </div>
  );
}
