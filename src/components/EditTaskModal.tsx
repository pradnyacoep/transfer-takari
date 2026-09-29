import React, { useState } from 'react';
import { X, Pencil, Bell, Layers } from 'lucide-react';
import { User, Task } from '../types';
import { PRIORITIES } from '../constants';
import {
  todayISO,
  assigneesForUnits,
  sectionHeadsForUnits,
  unitsForRole,
} from '../utils/helpers';
import { TagPicker, DayQuickPicks } from './CommonPickers';
import { getPackageBadgeColor, getTaskPackage } from '../utils/schemePackage';

export function EditTaskModal({
  task,
  users,
  tags,
  addTagIfNew,
  packages = [],
  onClose,
  onSave,
}: {
  task: Task;
  users: User[];
  tags: string[];
  addTagIfNew?: (tag: string, currentTags: string[]) => Promise<string[] | void>;
  packages?: string[];
  onClose: () => void;
  onSave: (updated: Task) => Promise<void> | void;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [priority, setPriority] = useState(task.priority);
  const [hasDeadline, setHasDeadline] = useState(!!task.deadline);
  const [deadline, setDeadline] = useState(task.deadline || todayISO());
  const [taskTags, setTaskTags] = useState<string[]>(task.tags || []);
  const [selectedPackage, setSelectedPackage] = useState<string>(
    getTaskPackage(task) || ''
  );
  const [hasNextFollowUp, setHasNextFollowUp] = useState(!!task.nextFollowUpDate);
  const [nextDate, setNextDate] = useState(
    task.nextFollowUpDate ? task.nextFollowUpDate.slice(0, 10) : todayISO()
  );
  const [nextDays, setNextDays] = useState('3');
  const [nextMode, setNextMode] = useState<'date' | 'days'>('days');

  const taskUnits = task.units || (task.unit ? [task.unit] : []);
  const [selectedIds, setSelectedIds] = useState<string[]>(
    task.assigneeIds && task.assigneeIds.length
      ? task.assigneeIds
      : task.assigneeId
      ? [task.assigneeId]
      : []
  );

  const people = assigneesForUnits(users, taskUnits);
  const heads = sectionHeadsForUnits(users, taskUnits);

  const canSubmit = title.trim().length > 0 && selectedIds.length > 0;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSave = () => {
    if (!canSubmit) return;

    const selectedMemberUsers = selectedIds
      .map((id) => people.find((p) => p.id === id))
      .filter(Boolean) as User[];

    const memberUnits = new Set(
      selectedMemberUsers.flatMap((u) =>
        unitsForRole(u, taskUnits, 'member')
      )
    );

    const autoHeadIds = heads
      .filter((h) =>
        unitsForRole(h, taskUnits, 'section_head').some((u) =>
          memberUnits.has(u)
        )
      )
      .map((h) => h.id);

    const assigneeIds = Array.from(new Set([...selectedIds, ...autoHeadIds]));

    let nextFollowUpDate: string | null = null;
    if (hasNextFollowUp) {
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

    onSave({
      ...task,
      title: title.trim(),
      description: description.trim(),
      priority,
      assigneeIds,
      deadline: hasDeadline ? deadline : null,
      nextFollowUpDate,
      tags: taskTags,
      package: selectedPackage.trim() || undefined,
      scheme: selectedPackage.trim() || undefined,
    });
  };

  return (
    <div className="tw-modal-overlay" onClick={onClose}>
      <div className="tw-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tw-modal-head">
          <div>
            <div className="tw-display" style={{ fontSize: 18, fontWeight: 600 }}>
              Edit task
            </div>
            <div
              className="tw-mono"
              style={{ fontSize: 10.5, color: 'var(--tw-ink-soft)', marginTop: 2 }}
            >
              #{task.id.slice(-6).toUpperCase()} · {taskUnits.join(', ')}
            </div>
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
            <label className="tw-label">
              Units (fixed — cannot be moved after allocation)
            </label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {taskUnits.map((u) => (
                <div
                  key={u}
                  className="tw-unit-tab active"
                  style={{ cursor: 'default' }}
                >
                  {u}
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label className="tw-label">
              Assign to (select one or more people)
            </label>
            <div
              className="tw-card"
              style={{ padding: 10, maxHeight: 190, overflowY: 'auto' }}
            >
              {people.length === 0 && heads.length === 0 && (
                <div style={{ fontSize: 12.5, color: 'var(--tw-ink-soft)' }}>
                  No users defined in this unit.
                </div>
              )}
              {heads.map((p) => (
                <label
                  key={`head-${p.id}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '5px 2px',
                    fontSize: 13.5,
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(p.id)}
                    onChange={() => toggleSelect(p.id)}
                  />
                  <span>
                    {p.name}{' '}
                    <span
                      className="tw-mono"
                      style={{ fontSize: 10, color: 'var(--tw-ink-soft)' }}
                    >
                      · {unitsForRole(p, taskUnits, 'section_head').join(', ')} ·
                      Section Head
                    </span>
                  </span>
                </label>
              ))}
              {people.map((p) => (
                <label
                  key={`member-${p.id}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '5px 2px',
                    fontSize: 13.5,
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(p.id)}
                    onChange={() => toggleSelect(p.id)}
                  />
                  <span>
                    {p.name}{' '}
                    <span
                      className="tw-mono"
                      style={{ fontSize: 10, color: 'var(--tw-ink-soft)' }}
                    >
                      · {unitsForRole(p, taskUnits, 'member').join(', ')}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            {heads.length > 0 && (
              <div
                style={{
                  fontSize: 11.5,
                  color: 'var(--tw-ink-soft)',
                  marginTop: 6,
                }}
              >
                Selecting a member automatically includes their section head as
                well.
              </div>
            )}
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
              <label
                className="tw-label"
                style={{ color: 'var(--tw-ink-soft)' }}
              >
                Deadline{' '}
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
                  marginBottom: hasDeadline ? 6 : 0,
                }}
              >
                <div
                  className={'tw-unit-tab' + (hasDeadline ? ' active' : '')}
                  onClick={() => setHasDeadline(true)}
                >
                  Dated
                </div>
                <div
                  className={'tw-unit-tab' + (!hasDeadline ? ' active' : '')}
                  onClick={() => setHasDeadline(false)}
                >
                  No deadline
                </div>
              </div>
              {hasDeadline && (
                <input
                  type="date"
                  className="tw-input"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              )}
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label className="tw-label">
              <Bell size={11} style={{ verticalAlign: '-1px' }} /> Next follow-up to be taken
            </label>
            <div
              style={{
                display: 'flex',
                gap: 6,
                marginBottom: hasNextFollowUp ? 6 : 0,
              }}
            >
              <div
                className={'tw-unit-tab' + (!hasNextFollowUp ? ' active' : '')}
                onClick={() => setHasNextFollowUp(false)}
              >
                Not scheduled
              </div>
              <div
                className={'tw-unit-tab' + (hasNextFollowUp ? ' active' : '')}
                onClick={() => setHasNextFollowUp(true)}
              >
                Schedule
              </div>
            </div>

            {hasNextFollowUp && (
              <div style={{ marginTop: 6 }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
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

                {nextMode === 'date' ? (
                  <input
                    type="date"
                    className="tw-input"
                    value={nextDate}
                    onChange={(e) => setNextDate(e.target.value)}
                  />
                ) : (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="number"
                      min="1"
                      className="tw-input"
                      style={{ maxWidth: 90 }}
                      placeholder="Days"
                      value={nextDays}
                      onChange={(e) => setNextDays(e.target.value)}
                    />
                    <DayQuickPicks value={nextDays} onSelect={setNextDays} />
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ marginBottom: 18 }}>
            <label className="tw-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Layers size={13} /> Package / Scheme <span style={{ fontSize: 10, textTransform: 'none', color: 'var(--tw-ink-soft)', fontWeight: 400 }}>(Optional)</span>
            </label>
            {(!packages || packages.length === 0) ? (
              <div style={{ fontSize: 12, color: 'var(--tw-ink-soft)', fontStyle: 'italic' }}>
                No packages configured yet. You can create packages in Admin &gt; Packages &amp; Schemes.
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  type="button"
                  className={`tw-unit-tab ${!selectedPackage ? 'active' : ''}`}
                  style={{ fontSize: 11.5, padding: '4px 10px' }}
                  onClick={() => setSelectedPackage('')}
                >
                  None (Unassigned)
                </button>
                {packages.map((pkg) => {
                  const pkgColor = getPackageBadgeColor(pkg);
                  const isActive = selectedPackage.toLowerCase() === pkg.toLowerCase();
                  return (
                    <button
                      key={pkg}
                      type="button"
                      className={`tw-unit-tab ${isActive ? 'active' : ''}`}
                      style={{
                        fontSize: 11.5,
                        padding: '4px 10px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        borderColor: isActive ? pkgColor : `${pkgColor}44`,
                        background: isActive ? pkgColor : '#FFFFFF',
                        color: isActive ? '#FFFFFF' : pkgColor,
                        fontWeight: 600,
                      }}
                      onClick={() => setSelectedPackage(isActive ? '' : pkg)}
                    >
                      <Layers size={11} /> {pkg}
                    </button>
                  );
                })}
              </div>
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
              onClick={handleSave}
            >
              <Pencil size={15} /> Save changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
