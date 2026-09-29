import React, { useState } from 'react';
import {
  Tag as TagIcon,
  X,
  Plus,
  User as UserIcon,
  Building2,
  ChevronDown,
  ChevronRight,
  LucideIcon,
} from 'lucide-react';
import { QUICK_DAY_OPTIONS } from '../constants';
import { User, Membership, Task, PersonalTask } from '../types';
import { TaskRow } from './TaskRow';
import { PersonalTaskRow } from './PersonalTaskRow';

export function DayQuickPicks({
  value,
  onSelect,
}: {
  value: string | number;
  onSelect: (val: string) => void;
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
      {QUICK_DAY_OPTIONS.map((n) => (
        <div
          key={n}
          className={'tw-day-chip' + (String(value) === String(n) ? ' active' : '')}
          onClick={() => onSelect(String(n))}
        >
          {n}
        </div>
      ))}
    </div>
  );
}

export function MentionInput({
  value,
  onChange,
  users,
  onSubmit,
  placeholder,
}: {
  value: string;
  onChange: (val: string) => void;
  users: User[];
  onSubmit: () => void;
  placeholder?: string;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [query, setQuery] = useState('');
  const [mentionStart, setMentionStart] = useState<number | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    onChange(val);

    const uptoCursor = val.slice(0, cursorPos);
    const atIndex = uptoCursor.lastIndexOf('@');
    if (atIndex !== -1) {
      const between = uptoCursor.slice(atIndex + 1);
      if (!/\s/.test(between)) {
        setMentionStart(atIndex);
        setQuery(between);
        setShowMenu(true);
        return;
      }
    }
    setShowMenu(false);
  };

  const selectUser = (name: string) => {
    if (mentionStart == null) return;
    const before = value.slice(0, mentionStart);
    const after = value.slice(mentionStart + 1 + query.length);
    const newVal = `${before}@${name} ${after}`;
    onChange(newVal);
    setShowMenu(false);
    setQuery('');
    setMentionStart(null);
  };

  const filtered = (users || [])
    .filter((u) => u.name.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 6);

  return (
    <div style={{ position: 'relative', flex: 1 }}>
      {showMenu && filtered.length > 0 && (
        <div
          className="tw-card"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            zIndex: 30,
            maxHeight: 170,
            overflowY: 'auto',
            padding: 4,
          }}
        >
          {filtered.map((u) => (
            <div
              key={u.id}
              className="tw-mention-item"
              onMouseDown={(e) => {
                e.preventDefault();
                selectUser(u.name);
              }}
            >
              {u.name}
            </div>
          ))}
        </div>
      )}
      <input
        className="tw-input"
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !showMenu) onSubmit();
          if (e.key === 'Escape') setShowMenu(false);
        }}
      />
    </div>
  );
}

export function TagPicker({
  allTags,
  selected,
  onChange,
  onCreateTag,
}: {
  allTags: string[];
  selected: string[];
  onChange: (tags: string[]) => void;
  onCreateTag?: (tag: string, currentTags: string[]) => Promise<string[] | void>;
}) {
  const [customValue, setCustomValue] = useState('');

  const toggle = (tag: string) => {
    onChange(
      selected.includes(tag)
        ? selected.filter((t) => t !== tag)
        : [...selected, tag]
    );
  };

  const addCustom = async () => {
    const clean = customValue.trim();
    if (!clean) return;
    if (!allTags.includes(clean) && onCreateTag) {
      await onCreateTag(clean, allTags);
    }
    if (!selected.includes(clean)) {
      onChange([...selected, clean]);
    }
    setCustomValue('');
  };

  return (
    <div>
      {allTags.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
            marginBottom: 10,
          }}
        >
          {allTags.map((tag) => (
            <div
              key={tag}
              className={
                'tw-unit-tab' + (selected.includes(tag) ? ' active' : '')
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
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          className="tw-input"
          placeholder="Create a new tag…"
          value={customValue}
          onChange={(e) => setCustomValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addCustom();
            }
          }}
        />
        <button
          type="button"
          className="tw-btn tw-btn-ghost"
          onClick={addCustom}
        >
          <Plus size={14} /> Add
        </button>
      </div>
      {selected.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
            marginTop: 10,
          }}
        >
          {selected.map((tag) => (
            <span
              key={tag}
              className="tw-tag"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '3px 8px',
              }}
            >
              {tag}
              <X
                size={11}
                style={{ cursor: 'pointer' }}
                onClick={() => toggle(tag)}
              />
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function PendingAtPicker({
  selected,
  onChange,
  allOffices,
  allUserNames,
  onCreateOffice,
}: {
  selected: string[];
  onChange: (val: string[]) => void;
  allOffices: string[];
  allUserNames: string[];
  onCreateOffice?: (office: string) => Promise<void>;
}) {
  const [subTab, setSubTab] = useState<'users' | 'offices' | null>(null);
  const [customValue, setCustomValue] = useState('');

  const userOptions = ['Myself', ...(allUserNames || [])];
  const officeOptions = allOffices || [];

  const toggle = (val: string) => {
    onChange(
      selected.includes(val)
        ? selected.filter((v) => v !== val)
        : [...selected, val]
    );
  };

  const addCustom = async () => {
    const clean = customValue.trim();
    if (!clean) return;
    if (!officeOptions.includes(clean) && onCreateOffice) {
      await onCreateOffice(clean);
    }
    if (!selected.includes(clean)) {
      onChange([...selected, clean]);
    }
    setCustomValue('');
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
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
      </div>

      {subTab === 'users' && (
        <div
          style={{
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
            marginBottom: 10,
          }}
        >
          {userOptions.map((opt) => (
            <div
              key={opt}
              className={
                'tw-unit-tab' + (selected.includes(opt) ? ' active' : '')
              }
              onClick={() => toggle(opt)}
            >
              <UserIcon
                size={10}
                style={{ verticalAlign: '-1px', marginRight: 3 }}
              />
              {opt}
            </div>
          ))}
        </div>
      )}

      {subTab === 'offices' && (
        <div style={{ marginBottom: 10 }}>
          <div
            style={{
              display: 'flex',
              gap: 6,
              flexWrap: 'wrap',
              marginBottom: 10,
            }}
          >
            {officeOptions.length === 0 && (
              <span style={{ fontSize: 12, color: 'var(--tw-ink-soft)' }}>
                No offices created yet.
              </span>
            )}
            {officeOptions.map((opt) => (
              <div
                key={opt}
                className={
                  'tw-unit-tab' + (selected.includes(opt) ? ' active' : '')
                }
                onClick={() => toggle(opt)}
              >
                <Building2
                  size={10}
                  style={{ verticalAlign: '-1px', marginRight: 3 }}
                />
                {opt}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="tw-input"
              placeholder="Create a new office / desk…"
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCustom();
                }
              }}
            />
            <button
              type="button"
              className="tw-btn tw-btn-ghost"
              onClick={addCustom}
            >
              <Plus size={14} /> Add
            </button>
          </div>
        </div>
      )}

      {selected.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
            marginTop: 4,
          }}
        >
          {selected.map((val) => (
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

export function DesignationPicker({
  value,
  onChange,
  allDesignations,
  onCreateDesignation,
}: {
  value?: string;
  onChange: (val: string) => void;
  allDesignations: string[];
  onCreateDesignation?: (desig: string) => Promise<void>;
}) {
  const [showCustom, setShowCustom] = useState(false);
  const [customValue, setCustomValue] = useState('');

  const options =
    value && !allDesignations.includes(value)
      ? [value, ...allDesignations]
      : allDesignations;

  const submitCustom = async () => {
    const clean = customValue.trim();
    if (!clean) return;
    if (!allDesignations.includes(clean) && onCreateDesignation) {
      await onCreateDesignation(clean);
    }
    onChange(clean);
    setCustomValue('');
    setShowCustom(false);
  };

  return (
    <div>
      <select
        className="tw-select"
        value={showCustom ? 'add_new' : value || ''}
        onChange={(e) => {
          if (e.target.value === 'add_new') {
            setShowCustom(true);
            return;
          }
          onChange(e.target.value);
        }}
      >
        <option value="">— None —</option>
        {options.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
        <option value="add_new">+ Add new designation…</option>
      </select>
      {showCustom && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input
            className="tw-input"
            placeholder="New designation"
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

export function MembershipEditor({
  units,
  memberships,
  setMemberships,
}: {
  units: string[];
  memberships: Membership[];
  setMemberships: (m: Membership[]) => void;
}) {
  const addRow = () => {
    const used = memberships.map((m) => m.unit);
    const nextUnit = units.find((u) => !used.includes(u)) || units[0] || '';
    setMemberships([...memberships, { unit: nextUnit, role: 'member' }]);
  };

  const updateRow = (
    idx: number,
    field: keyof Membership,
    value: string
  ) => {
    setMemberships(
      memberships.map((m, i) => (i === idx ? { ...m, [field]: value } : m))
    );
  };

  const removeRow = (idx: number) => {
    setMemberships(memberships.filter((_, i) => i !== idx));
  };

  return (
    <div>
      <label className="tw-label">
        Unit assignments (one person can hold a role in multiple units)
      </label>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          marginBottom: 8,
        }}
      >
        {memberships.map((m, idx) => (
          <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select
              className="tw-select"
              style={{ flex: 1.4 }}
              value={m.unit}
              onChange={(e) => updateRow(idx, 'unit', e.target.value)}
            >
              {units.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
            <select
              className="tw-select"
              style={{ flex: 1 }}
              value={m.role}
              onChange={(e) =>
                updateRow(
                  idx,
                  'role',
                  e.target.value as 'section_head' | 'member'
                )
              }
            >
              <option value="section_head">Section Head</option>
              <option value="member">Member</option>
            </select>
            <button
              type="button"
              className="tw-iconbtn"
              onClick={() => removeRow(idx)}
              title="Remove this assignment"
            >
              <X size={14} />
            </button>
          </div>
        ))}
        {memberships.length === 0 && (
          <div style={{ fontSize: 12.5, color: 'var(--tw-ink-soft)' }}>
            No unit assigned yet.
          </div>
        )}
      </div>
      <button
        type="button"
        className="tw-btn tw-btn-ghost"
        onClick={addRow}
      >
        <Plus size={14} /> Add another unit
      </button>
    </div>
  );
}

export function CollapsibleSection({
  title,
  icon: Icon,
  badge,
  defaultOpen,
  children,
}: {
  title: string;
  icon?: LucideIcon;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div style={{ marginBottom: 18 }}>
      <div
        className="tw-section-title"
        style={{
          fontSize: 14,
          cursor: 'pointer',
          justifyContent: 'space-between',
        }}
        onClick={() => setOpen((o) => !o)}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {Icon && <Icon size={14} />} {title}
          {badge}
        </span>
        {open ? (
          <ChevronDown size={15} color="var(--tw-ink-soft)" />
        ) : (
          <ChevronRight size={15} color="var(--tw-ink-soft)" />
        )}
      </div>
      {open && <div style={{ marginTop: 8 }}>{children}</div>}
    </div>
  );
}

export function InfoLine({
  label,
  value,
  highlight,
  muted,
}: {
  label: string;
  value: React.ReactNode;
  highlight?: boolean;
  muted?: boolean;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 10.5,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          color: 'var(--tw-ink-soft)',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontWeight: highlight ? 600 : muted ? 400 : 500,
          color: highlight
            ? 'var(--tw-seal)'
            : muted
            ? 'var(--tw-ink-soft)'
            : undefined,
          fontSize: muted ? 12.5 : undefined,
        }}
      >
        {value}
      </div>
    </div>
  );
}

export function TaskListModal({
  title,
  tasks,
  users,
  onOpen,
  onClose,
  onOpenWhatsApp,
  onTriggerReminder,
  onUpdateTask,
}: {
  title: string;
  tasks: Task[];
  users: User[];
  onOpen: (id: string) => void;
  onClose: () => void;
  onOpenWhatsApp?: (task: Task, reminderType?: string) => void;
  onTriggerReminder?: (task: Task, type: '1st_reminder' | '2nd_reminder') => void;
  onUpdateTask?: (updated: Task) => void;
}) {
  return (
    <div className="tw-modal-overlay" onClick={onClose}>
      <div className="tw-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tw-modal-head">
          <div className="tw-display" style={{ fontSize: 18, fontWeight: 600 }}>
            {title}
          </div>
          <button className="tw-iconbtn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="tw-modal-body">
          {tasks.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--tw-ink-soft)' }}>
              No tasks in this category.
            </div>
          )}
          {tasks.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              users={users}
              onOpen={() => onOpen(t.id)}
              onUpdateTask={onUpdateTask}
              onOpenWhatsApp={onOpenWhatsApp}
              onTriggerReminder={onTriggerReminder}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function PersonalTaskListModal({
  title,
  tasks,
  onOpen,
  onClose,
}: {
  title: string;
  tasks: PersonalTask[];
  onOpen: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="tw-modal-overlay" onClick={onClose}>
      <div className="tw-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tw-modal-head">
          <div className="tw-display" style={{ fontSize: 18, fontWeight: 600 }}>
            {title}
          </div>
          <button className="tw-iconbtn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="tw-modal-body">
          {tasks.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--tw-ink-soft)' }}>
              No tasks in this category.
            </div>
          )}
          {tasks.map((t) => (
            <PersonalTaskRow
              key={t.id}
              task={t}
              onOpen={() => onOpen(t.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
