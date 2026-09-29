import React, { useState } from 'react';
import { Calendar, Clock, X, Check, ArrowRight, AlertCircle, RefreshCw } from 'lucide-react';
import { Task } from '../types';
import { todayISO, fmtDate, fmtDateTime } from '../utils/helpers';

export interface BatchRescheduleModalProps {
  selectedTasks: Task[];
  onClose: () => void;
  onApply: (params: {
    targetDateISO: string | null;
    note?: string;
    unselectedTaskIds?: string[];
  }) => void;
}

export function BatchRescheduleModal({
  selectedTasks,
  onClose,
  onApply,
}: BatchRescheduleModalProps) {
  const today = todayISO();
  const [selectedIds, setSelectedIds] = useState<string[]>(
    selectedTasks.map((t) => t.id)
  );

  // Default to +2 days from today
  const defaultDate = new Date();
  defaultDate.setDate(defaultDate.getDate() + 2);
  const defaultDateStr = `${defaultDate.getFullYear()}-${String(
    defaultDate.getMonth() + 1
  ).padStart(2, '0')}-${String(defaultDate.getDate()).padStart(2, '0')}`;

  const [dateVal, setDateVal] = useState(defaultDateStr);
  const [timeVal, setTimeVal] = useState('05:30');
  const [noteVal, setNoteVal] = useState('');
  const [mode, setMode] = useState<'set' | 'clear'>('set');

  // Compute preset dates
  const getPresetDate = (daysAhead: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;
  };

  const getNextMonday = () => {
    const d = new Date();
    const day = d.getDay(); // 0 is Sunday, 1 is Monday
    const diff = day === 0 ? 1 : 8 - day;
    d.setDate(d.getDate() + diff);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;
  };

  const getEndOfMonth = () => {
    const d = new Date();
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(
      2,
      '0'
    )}-${String(lastDay.getDate()).padStart(2, '0')}`;
  };

  const presets = [
    { label: 'Tomorrow (+1d)', date: getPresetDate(1) },
    { label: '+2 Days', date: getPresetDate(2) },
    { label: '+3 Days', date: getPresetDate(3) },
    { label: '+1 Week (+7d)', date: getPresetDate(7) },
    { label: 'Next Monday', date: getNextMonday() },
    { label: '+2 Weeks', date: getPresetDate(14) },
    { label: 'End of Month', date: getEndOfMonth() },
  ];

  const toggleTaskId = (id: string) => {
    if (selectedIds.includes(id)) {
      if (selectedIds.length === 1) return; // keep at least one
      setSelectedIds(selectedIds.filter((x) => x !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'clear') {
      onApply({
        targetDateISO: null,
        note: noteVal.trim() || 'Follow-up schedule cleared in batch',
        unselectedTaskIds: selectedTasks
          .filter((t) => !selectedIds.includes(t.id))
          .map((t) => t.id),
      });
      return;
    }

    if (!dateVal) return;
    const finalISO = `${dateVal}T${timeVal || '05:30'}:00+05:30`;
    onApply({
      targetDateISO: finalISO,
      note: noteVal.trim() || undefined,
      unselectedTaskIds: selectedTasks
        .filter((t) => !selectedIds.includes(t.id))
        .map((t) => t.id),
    });
  };

  const previewDateTimeStr =
    mode === 'clear'
      ? 'Clear schedule (no follow-up date)'
      : fmtDateTime(`${dateVal}T${timeVal || '05:30'}:00+05:30`);

  return (
    <div className="tw-modal-overlay" onClick={onClose}>
      <div
        className="tw-modal-card"
        style={{ maxWidth: 640, width: '92vw' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--tw-line)',
            paddingBottom: 12,
            marginBottom: 16,
          }}
        >
          <div>
            <div
              className="tw-display"
              style={{
                fontSize: 20,
                fontWeight: 600,
                color: 'var(--tw-ink)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <RefreshCw size={19} color="var(--tw-steel)" /> Quick Batch Rescheduling
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--tw-ink-soft)', marginTop: 2 }}>
              Postpone or schedule follow-up dates for {selectedIds.length} selected task
              {selectedIds.length === 1 ? '' : 's'}.
            </div>
          </div>
          <button
            type="button"
            className="tw-btn tw-btn-ghost"
            style={{ padding: '6px 8px' }}
            onClick={onClose}
          >
            <X size={17} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Selected Tasks List preview */}
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 11.5,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: 'var(--tw-ink-soft)',
                marginBottom: 6,
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span>Selected Tasks ({selectedIds.length})</span>
              <span style={{ fontSize: 11, fontWeight: 400 }}>Click to remove from batch</span>
            </div>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 6,
                maxHeight: 120,
                overflowY: 'auto',
                padding: '8px 10px',
                background: 'var(--tw-paper-deep)',
                borderRadius: 'var(--tw-radius-sm)',
                border: '1px solid var(--tw-line)',
              }}
            >
              {selectedTasks.map((t) => {
                const isChecked = selectedIds.includes(t.id);
                return (
                  <span
                    key={t.id}
                    onClick={() => toggleTaskId(t.id)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '3px 8px',
                      borderRadius: 14,
                      fontSize: 11.5,
                      cursor: 'pointer',
                      background: isChecked ? '#FFFFFF' : 'transparent',
                      color: isChecked ? 'var(--tw-ink)' : 'var(--tw-ink-soft)',
                      border: isChecked ? '1px solid var(--tw-line)' : '1px dashed var(--tw-line)',
                      opacity: isChecked ? 1 : 0.6,
                      textDecoration: isChecked ? 'none' : 'line-through',
                    }}
                    title={isChecked ? 'Click to deselect from batch' : 'Click to re-include'}
                  >
                    <span className="tw-mono" style={{ fontWeight: 600, color: 'var(--tw-steel)' }}>
                      #{t.id.replace('tsk_', '').toUpperCase()}
                    </span>
                    <span
                      style={{
                        maxWidth: 160,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {t.title}
                    </span>
                    {isChecked ? <X size={11} /> : <Check size={11} />}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Mode toggle */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button
              type="button"
              className={'tw-btn ' + (mode === 'set' ? 'tw-btn-primary' : 'tw-btn-ghost')}
              style={{ fontSize: 12.5, flex: 1, padding: '7px 12px' }}
              onClick={() => setMode('set')}
            >
              <Calendar size={14} /> Schedule Target Date
            </button>
            <button
              type="button"
              className={'tw-btn ' + (mode === 'clear' ? 'tw-btn-primary' : 'tw-btn-ghost')}
              style={{
                fontSize: 12.5,
                flex: 1,
                padding: '7px 12px',
                borderColor: mode === 'clear' ? 'var(--tw-seal)' : undefined,
                background: mode === 'clear' ? 'var(--tw-seal)' : undefined,
              }}
              onClick={() => setMode('clear')}
            >
              <X size={14} /> Clear Next Follow-up
            </button>
          </div>

          {mode === 'set' && (
            <>
              {/* Quick Presets */}
              <div style={{ marginBottom: 14 }}>
                <div
                  style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: 'var(--tw-ink-soft)',
                    marginBottom: 6,
                  }}
                >
                  Quick Date Presets
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {presets.map((p) => {
                    const isSelected = dateVal === p.date;
                    return (
                      <button
                        key={p.label}
                        type="button"
                        className={'tw-btn ' + (isSelected ? '' : 'tw-btn-ghost')}
                        style={{
                          fontSize: 11.5,
                          padding: '5px 9px',
                          background: isSelected ? 'var(--tw-steel)' : undefined,
                          color: isSelected ? '#FFFFFF' : undefined,
                        }}
                        onClick={() => setDateVal(p.date)}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Date & Time Picker inputs */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 140px',
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: 'var(--tw-ink-soft)',
                      marginBottom: 4,
                    }}
                  >
                    Target Date
                  </label>
                  <input
                    type="date"
                    className="tw-input"
                    value={dateVal}
                    min={today}
                    onChange={(e) => setDateVal(e.target.value)}
                    required
                    style={{ width: '100%', fontSize: 13, padding: '7px 10px' }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: 'var(--tw-ink-soft)',
                      marginBottom: 4,
                    }}
                  >
                    Time (IST)
                  </label>
                  <input
                    type="time"
                    className="tw-input"
                    value={timeVal}
                    onChange={(e) => setTimeVal(e.target.value)}
                    style={{ width: '100%', fontSize: 13, padding: '7px 10px' }}
                  />
                </div>
              </div>
            </>
          )}

          {/* Optional Remark / Reason note */}
          <div style={{ marginBottom: 18 }}>
            <label
              style={{
                display: 'block',
                fontSize: 11.5,
                fontWeight: 600,
                color: 'var(--tw-ink-soft)',
                marginBottom: 4,
              }}
            >
              Follow-up Remark / Reason (Optional)
            </label>
            <input
              type="text"
              className="tw-input"
              placeholder="e.g. Postponed for division meeting / letter dispatch"
              value={noteVal}
              onChange={(e) => setNoteVal(e.target.value)}
              style={{ width: '100%', fontSize: 12.5, padding: '7px 10px' }}
            />
          </div>

          {/* Impact preview card */}
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--tw-radius-sm)',
              background: mode === 'clear' ? '#FDF2F1' : '#F0F6FA',
              border: `1px solid ${mode === 'clear' ? '#F3C2BE' : '#C5DDEE'}`,
              fontSize: 12.5,
              color: mode === 'clear' ? '#B23A2E' : 'var(--tw-ink)',
              marginBottom: 18,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <ArrowRight size={15} color={mode === 'clear' ? '#B23A2E' : 'var(--tw-steel)'} />
            <div>
              <strong>Action Summary:</strong> {selectedIds.length} tasks will be updated to{' '}
              <strong>{previewDateTimeStr}</strong>.
            </div>
          </div>

          {/* Footer buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button
              type="button"
              className="tw-btn tw-btn-ghost"
              onClick={onClose}
              style={{ fontSize: 13, padding: '8px 16px' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="tw-btn tw-btn-primary"
              style={{
                fontSize: 13,
                padding: '8px 20px',
                background: mode === 'clear' ? 'var(--tw-seal)' : 'var(--tw-ink)',
              }}
              disabled={selectedIds.length === 0 || (mode === 'set' && !dateVal)}
            >
              {mode === 'clear' ? 'Clear Follow-up' : 'Apply Reschedule'} ({selectedIds.length}{' '}
              task{selectedIds.length === 1 ? '' : 's'})
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
