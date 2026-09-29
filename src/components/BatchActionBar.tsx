import React from 'react';
import { Calendar, Clock, RefreshCw, X, FastForward, CheckSquare } from 'lucide-react';

export interface BatchActionBarProps {
  selectedCount: number;
  totalCount?: number;
  onPostponeTwoDays: () => void;
  onPostponeOneWeek: () => void;
  onOpenCustomModal: () => void;
  onClearDate: () => void;
  onDeselectAll: () => void;
  onSelectAllVisible?: () => void;
}

export function BatchActionBar({
  selectedCount,
  totalCount,
  onPostponeTwoDays,
  onPostponeOneWeek,
  onOpenCustomModal,
  onClearDate,
  onDeselectAll,
  onSelectAllVisible,
}: BatchActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 90,
        background: '#1B2A4A',
        color: '#FAF9F5',
        padding: '10px 18px',
        borderRadius: 40,
        boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
        maxWidth: '92vw',
        border: '1px solid rgba(255,255,255,0.15)',
        animation: 'fadeInUp 0.2s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            background: 'var(--tw-seal)',
            color: '#FFFFFF',
            fontWeight: 700,
            fontSize: 12,
            padding: '2px 8px',
            borderRadius: 12,
          }}
        >
          {selectedCount}
        </span>
        <span style={{ fontSize: 13, fontWeight: 500 }}>
          task{selectedCount === 1 ? '' : 's'} selected
        </span>
      </div>

      <div
        style={{
          width: 1,
          height: 20,
          background: 'rgba(255,255,255,0.2)',
          margin: '0 2px',
        }}
      />

      {/* Quick batch reschedule actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button
          type="button"
          onClick={onPostponeTwoDays}
          style={{
            background: 'rgba(255,255,255,0.12)',
            color: '#FFFFFF',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 20,
            padding: '6px 12px',
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.25)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
          title="Postpone follow-up date by 2 days"
        >
          <FastForward size={13} /> +2 Days
        </button>

        <button
          type="button"
          onClick={onPostponeOneWeek}
          style={{
            background: 'rgba(255,255,255,0.12)',
            color: '#FFFFFF',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 20,
            padding: '6px 12px',
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.25)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
          title="Postpone follow-up date by 1 week (7 days)"
        >
          <Calendar size={13} /> +1 Week
        </button>

        <button
          type="button"
          onClick={onOpenCustomModal}
          style={{
            background: 'var(--tw-steel)',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: 20,
            padding: '6px 14px',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          title="Open custom date picker and presets"
        >
          <Clock size={13} /> Custom Date…
        </button>

        <button
          type="button"
          onClick={onClearDate}
          style={{
            background: 'transparent',
            color: '#F87171',
            border: '1px solid rgba(248,113,113,0.4)',
            borderRadius: 20,
            padding: '6px 10px',
            fontSize: 12,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
          title="Clear follow-up date for selected tasks"
        >
          Clear
        </button>
      </div>

      <div
        style={{
          width: 1,
          height: 20,
          background: 'rgba(255,255,255,0.2)',
          margin: '0 2px',
        }}
      />

      {/* Select all / Deselect all */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {onSelectAllVisible && totalCount && selectedCount < totalCount && (
          <button
            type="button"
            onClick={onSelectAllVisible}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255,255,255,0.8)',
              fontSize: 12,
              cursor: 'pointer',
              padding: '4px 6px',
            }}
          >
            Select All ({totalCount})
          </button>
        )}

        <button
          type="button"
          onClick={onDeselectAll}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,0.6)',
            fontSize: 12,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            padding: '4px 6px',
          }}
          title="Clear selection"
        >
          <X size={14} /> Deselect
        </button>
      </div>
    </div>
  );
}
