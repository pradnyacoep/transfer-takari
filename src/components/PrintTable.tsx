import React from 'react';
import { Task, User } from '../types';
import { STATUS_LABEL } from '../constants';
import { fmtDate, fmtDateTime, getFollowUpColor } from '../utils/helpers';

export function PrintTable({
  title,
  tasks,
  users,
}: {
  title: string;
  tasks: Task[];
  users: User[];
}) {
  return (
    <div className="tw-print-table">
      <h1>{title}</h1>
      <div className="tw-print-meta">
        Task Register · Printed {fmtDateTime(new Date().toISOString())} ·{' '}
        {tasks.length} task{tasks.length === 1 ? '' : 's'}
      </div>
      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Unit(s)</th>
            <th>Assignees</th>
            <th>Priority</th>
            <th>Status</th>
            <th>Next Follow-up</th>
            <th>Pending At</th>
            <th>Deadline</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => {
            const assignees = (t.assigneeIds || [])
              .map((id) => {
                const u = users.find((x) => x.id === id);
                return u ? u.name : '';
              })
              .filter(Boolean)
              .join(', ');

            return (
              <tr key={t.id}>
                <td>{t.title}</td>
                <td>{(t.units || []).join(', ')}</td>
                <td>{assignees || '—'}</td>
                <td>{t.priority || ''}</td>
                <td>{STATUS_LABEL[t.status] || t.status}</td>
                <td
                  style={{
                    fontWeight: 700,
                    color: t.nextFollowUpDate ? getFollowUpColor(t) : undefined,
                  }}
                >
                  {t.nextFollowUpDate ? fmtDate(t.nextFollowUpDate) : '—'}
                </td>
                <td>{(t.pendingAt || []).join(', ') || '—'}</td>
                <td>{t.deadline ? fmtDate(t.deadline) : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
