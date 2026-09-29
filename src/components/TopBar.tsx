import React from 'react';
import {
  LayoutDashboard,
  CalendarDays,
  BarChart3,
  ShieldCheck,
  LogOut,
  Stamp,
  Cloud,
  CloudCheck,
  RefreshCw,
} from 'lucide-react';
import { User } from '../types';
import { membershipSummaryShort } from '../utils/helpers';

export function TopBar({
  currentUser,
  view,
  setView,
  onLogout,
  followUpAlertCount,
  syncStatus = 'connected',
  lastSyncedTime,
  onManualSync,
}: {
  currentUser: User;
  view: string;
  setView: (v: string) => void;
  onLogout: () => void;
  followUpAlertCount?: number;
  syncStatus?: 'connected' | 'syncing' | 'offline';
  lastSyncedTime?: string | null;
  onManualSync?: () => void;
}) {
  const tabs = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    {
      key: 'calendar',
      label: 'Follow-up Calendar',
      icon: CalendarDays,
      badge: followUpAlertCount && followUpAlertCount > 0 ? followUpAlertCount : undefined,
    },
    { key: 'analytics', label: 'Analytics', icon: BarChart3 },
  ];
  if (currentUser.role === 'admin') {
    tabs.push({ key: 'admin', label: 'Admin', icon: ShieldCheck });
  }

  const initials = currentUser.name
    .split(' ')
    .map((x) => x[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <header className="tw-topbar">
      <div className="tw-brand">
        <Stamp size={22} color="var(--tw-seal)" />
        <div>
          <div className="tw-brand-title">Task Register</div>
          <div className="tw-brand-sub">Allocation & Follow-up</div>
        </div>
      </div>

      <nav className="tw-nav" aria-label="Main Navigation">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              className={'tw-navbtn' + (view === t.key ? ' active' : '')}
              onClick={() => setView(t.key)}
            >
              <Icon size={15} /> {t.label}
              {t.badge && (
                <span
                  style={{
                    background: view === t.key ? '#FFFFFF' : 'var(--tw-seal)',
                    color: view === t.key ? 'var(--tw-ink)' : '#FFFFFF',
                    fontSize: 10.5,
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: 10,
                    marginLeft: 4,
                  }}
                >
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Live Cloud Sync Indicator & Active Sync Now Action */}
        <button
          className="tw-sync-pill"
          onClick={onManualSync}
          style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
          title={`Synchronized across PC, Tab & Mobile in real-time. Last synced: ${lastSyncedTime || 'just now'}. Click to Sync Now across all devices.`}
          aria-label="Cloud sync status"
        >
          <span className={`tw-sync-dot ${syncStatus}`} />
          <span className="tw-sync-text">
            {syncStatus === 'connected' ? 'Cloud Synced' : syncStatus === 'syncing' ? 'Syncing…' : 'Offline Mode'}
          </span>
          {syncStatus === 'syncing' ? (
            <RefreshCw size={11} className="tw-spin" />
          ) : (
            <RefreshCw size={11} style={{ opacity: 0.8 }} />
          )}
        </button>

        <div className="tw-userchip">
          <div className="tw-avatar">{initials}</div>
          <div>
            <div
              style={{
                fontWeight: 600,
                fontSize: 13.5,
                color: 'var(--tw-ink)',
              }}
            >
              {currentUser.name}
            </div>
            <div
              className="tw-mono"
              style={{ fontSize: 10.5, color: 'var(--tw-ink-soft)' }}
            >
              {membershipSummaryShort(currentUser)}
            </div>
          </div>
          <button className="tw-logout" onClick={onLogout} title="Sign out">
            <LogOut size={13} /> Exit
          </button>
        </div>
      </div>
    </header>
  );
}
