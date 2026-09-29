import React, { useState } from 'react';
import { Stamp, ChevronRight, User as UserIcon } from 'lucide-react';
import { User } from '../types';
import { membershipSummary } from '../utils/helpers';

export function LoginScreen({
  users,
  onLogin,
}: {
  users: User[];
  onLogin: (u: User) => void;
}) {
  const [showOtherStaff, setShowOtherStaff] = useState(false);
  const admin = users.find((u) => u.role === 'admin' && u.active !== false);
  const otherUsers = users.filter((u) => u.role !== 'admin' && u.active !== false);

  return (
    <div
      className="tw-graph-bg"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 30,
      }}
    >
      <div className="tw-card tw-login-card" style={{ padding: 30, width: '100%' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            marginBottom: 14,
          }}
        >
          <div className="tw-stamp" style={{ color: 'var(--tw-seal)' }}>
            <Stamp size={24} />
          </div>
        </div>

        <div
          className="tw-display"
          style={{
            textAlign: 'center',
            fontSize: 21,
            fontWeight: 600,
            color: 'var(--tw-ink)',
          }}
        >
          Task Register
        </div>
        <div
          className="tw-mono"
          style={{
            textAlign: 'center',
            fontSize: 11,
            color: 'var(--tw-ink-soft)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: 22,
          }}
        >
          Allocation · Monitoring · Follow-up
        </div>

        {admin ? (
          <button
            onClick={() => onLogin(admin)}
            className="tw-btn"
            style={{ justifyContent: 'space-between', width: '100%', padding: '12px 16px' }}
          >
            <span
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
              }}
            >
              <span style={{ fontWeight: 600, fontSize: 14.5 }}>{admin.name}</span>
              <span
                className="tw-mono"
                style={{ fontSize: 10.5, opacity: 0.85, marginTop: 2 }}
              >
                {membershipSummary(admin)}
              </span>
            </span>
            <ChevronRight size={16} />
          </button>
        ) : (
          <button
            onClick={() =>
              onLogin({
                id: 'usr_ee_admin',
                name: 'Executive Engineer',
                role: 'admin',
                unit: null,
                designation: 'Executive Engineer',
                phone: '',
                active: true,
                memberships: [],
              })
            }
            className="tw-btn"
            style={{ justifyContent: 'space-between', width: '100%', padding: '12px 16px' }}
          >
            <span
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
              }}
            >
              <span style={{ fontWeight: 600, fontSize: 14.5 }}>Executive Engineer</span>
              <span
                className="tw-mono"
                style={{ fontSize: 10.5, opacity: 0.85, marginTop: 2 }}
              >
                Division Admin · All Units
              </span>
            </span>
            <ChevronRight size={16} />
          </button>
        )}

        <div
          style={{
            marginTop: 18,
            fontSize: 11.5,
            color: 'var(--tw-ink-soft)',
            textAlign: 'center',
          }}
        >
          Team members and their roles are managed inside the Admin panel — this
          app is for your own single login.
        </div>

        {otherUsers.length > 0 && (
          <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid var(--tw-line)' }}>
            <button
              type="button"
              className="tw-btn tw-btn-ghost"
              style={{ width: '100%', fontSize: 12, padding: '6px 10px', justifyContent: 'center' }}
              onClick={() => setShowOtherStaff((v) => !v)}
            >
              <UserIcon size={12} /> {showOtherStaff ? 'Hide other staff roles' : 'Sign in as other team member'}
            </button>
            {showOtherStaff && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10, maxHeight: 180, overflowY: 'auto' }}>
                {otherUsers.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => onLogin(u)}
                    className="tw-btn tw-btn-ghost"
                    style={{
                      justifyContent: 'space-between',
                      textAlign: 'left',
                      fontSize: 12,
                      padding: '7px 10px',
                      border: '1px solid var(--tw-line)',
                    }}
                  >
                    <span>
                      <strong>{u.name}</strong>{' '}
                      <span className="tw-mono" style={{ fontSize: 10.5, color: 'var(--tw-ink-soft)' }}>
                        ({u.designation || u.role})
                      </span>
                    </span>
                    <ChevronRight size={13} />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
