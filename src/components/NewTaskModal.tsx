import React, { useState, useEffect } from 'react';
import { X, Plus, Bell, Layers } from 'lucide-react';
import { User, Task } from '../types';
import { PRIORITIES } from '../constants';
import {
  todayISO,
  unitsAssignableBy,
  assigneesForUnits,
  sectionHeadsForUnits,
  unitsForRole,
} from '../utils/helpers';
import { DayQuickPicks, TagPicker } from './CommonPickers';
import { getPackageBadgeColor } from '../utils/schemePackage';

export function NewTaskModal({
  currentUser,
  users,
  units,
  tags,
  addTagIfNew,
  packages = [],
  initialNextFollowUpDate,
  onClose,
  onCreate,
}: {
  currentUser: User;
  users: User[];
  units: string[];
  tags: string[];
  addTagIfNew?: (tag: string, currentTags: string[]) => Promise<string[] | void>;
  packages?: string[];
  initialNextFollowUpDate?: string | null;
  onClose: () => void;
  onCreate: (draft: Partial<Task>) => Promise<void> | void;
}) {
  const assignableUnits = unitsAssignableBy(currentUser, units);
  const [selectedUnits, setSelectedUnits] = useState<string[]>(
    assignableUnits.length ? [assignableUnits[0]] : []
  );
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<string>('Medium');
  const [hasDeadline, setHasDeadline] = useState(false);
  const [deadline, setDeadline] = useState(todayISO());
  const [hasNextFollowUp, setHasNextFollowUp] = useState(!!initialNextFollowUpDate);
  const [nextMode, setNextMode] = useState<'date' | 'days'>(
    initialNextFollowUpDate ? 'date' : 'days'
  );
  const [nextDate, setNextDate] = useState(initialNextFollowUpDate || todayISO());
  const [nextDays, setNextDays] = useState('3');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [taskTags, setTaskTags] = useState<string[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<string>('');

  const people = assigneesForUnits(users, selectedUnits);
  const heads = sectionHeadsForUnits(users, selectedUnits);

  useEffect(() => {
    const validIds = new Set([...people, ...heads].map((u) => u.id));
    setSelectedIds((prev) => prev.filter((id) => validIds.has(id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUnits.join('|')]);

  const toggleUnit = (u: string) => {
    setSelectedUnits((prev) =>
      prev.includes(u) ? prev.filter((x) => x !== u) : [...prev, u]
    );
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const canSubmit =
    title.trim().length > 0 &&
    selectedUnits.length > 0 &&
    selectedIds.length > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;

    const selectedMemberUsers = selectedIds
      .map((id) => people.find((p) => p.id === id))
      .filter(Boolean) as User[];

    const memberUnits = new Set(
      selectedMemberUsers.flatMap((u) =>
        unitsForRole(u, selectedUnits, 'member')
      )
    );

    const autoHeadIds = heads
      .filter((h) =>
        unitsForRole(h, selectedUnits, 'section_head').some((u) =>
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

    onCreate({
      title: title.trim(),
      description: description.trim(),
      units: selectedUnits,
      assigneeIds,
      priority,
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
          <div className="tw-display" style={{ fontSize: 18, fontWeight: 600 }}>
            Allocate new task
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
              placeholder="e.g. Scrutiny of DTP DTN No. 22/2026-27"
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
              placeholder="Scope, references, expected output…"
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label className="tw-label">Units (select one or more)</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {assignableUnits.map((u) => (
                <div
                  key={u}
                  className={
                    'tw-unit-tab' + (selectedUnits.includes(u) ? ' active' : '')
                  }
                  onClick={() => toggleUnit(u)}
                >
                  {u}
                </div>
              ))}
              {assignableUnits.length === 0 && (
                <div style={{ fontSize: 12.5, color: 'var(--tw-ink-soft)' }}>
                  No units available to you.
                </div>
              )}
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
                  No users defined in the selected unit(s) yet. Add users under
                  Admin first.
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
                      ·{' '}
                      {unitsForRole(p, selectedUnits, 'section_head').join(', ')}{' '}
                      · Section Head
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
                      · {unitsForRole(p, selectedUnits, 'member').join(', ')}
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
              <label className="tw-label">
                <Bell size={11} style={{ verticalAlign: '-1px' }} /> Next
                follow-up to be taken
              </label>
              <div
                style={{
                  display: 'flex',
                  gap: 6,
                  marginBottom: hasNextFollowUp ? 6 : 0,
                }}
              >
                <div
                  className={
                    'tw-unit-tab' + (!hasNextFollowUp ? ' active' : '')
                  }
                  onClick={() => setHasNextFollowUp(false)}
                >
                  Not set
                </div>
                <div
                  className={
                    'tw-unit-tab' + (hasNextFollowUp ? ' active' : '')
                  }
                  onClick={() => setHasNextFollowUp(true)}
                >
                  Schedule
                </div>
              </div>

              {hasNextFollowUp && (
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
              Deadline{' '}
              <span
                className="tw-mono"
                style={{ fontSize: 10, textTransform: 'none', letterSpacing: 0 }}
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
                style={{ maxWidth: 220 }}
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            )}
          </div>

          <div style={{ marginBottom: 18 }}>
            <label className="tw-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Layers size={13} /> Package / Scheme <span style={{ fontSize: 10, textTransform: 'none', color: 'var(--tw-ink-soft)', fontWeight: 400 }}>(Optional)</span>
            </label>
            {(!packages || packages.length === 0) ? (
              <div style={{ fontSize: 12, color: 'var(--tw-ink-soft)', fontStyle: 'italic' }}>
                No packages created yet in Admin. Tasks are unassigned to any package by default.
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
              onClick={handleSubmit}
            >
              <Plus size={15} /> Allocate
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
