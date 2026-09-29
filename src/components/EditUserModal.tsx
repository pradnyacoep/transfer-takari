import React, { useState } from 'react';
import { X, Pencil } from 'lucide-react';
import { User, Membership } from '../types';
import { DESIGNATION_HIERARCHY } from '../constants';
import { userMemberships } from '../utils/helpers';
import { DesignationPicker, MembershipEditor } from './CommonPickers';
import { formatIndianPhoneNumber, extractIndianMobileDigits } from '../utils/phoneUtils';

export function EditUserModal({
  user,
  units,
  existingUsers,
  allDesignations,
  addDesignationIfNew,
  onClose,
  onSave,
}: {
  user: User;
  units: string[];
  existingUsers: User[];
  allDesignations: string[];
  addDesignationIfNew?: (d: string) => Promise<void>;
  onClose: () => void;
  onSave: (updated: User) => Promise<void> | void;
}) {
  const [name, setName] = useState(user.name);
  const [designation, setDesignation] = useState(user.designation || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [memberships, setMemberships] = useState<Membership[]>(
    userMemberships(user).length
      ? userMemberships(user)
      : units.length
      ? [{ unit: units[0], role: 'member' }]
      : []
  );

  const isAdmin = user.role === 'admin';
  const isDuplicate =
    name.trim() &&
    (existingUsers || []).some(
      (x) =>
        x.id !== user.id &&
        x.name.trim().toLowerCase() === name.trim().toLowerCase()
    );

  const canSubmit =
    name.trim().length > 0 &&
    !isDuplicate &&
    (isAdmin || (memberships.length > 0 && memberships.every((m) => m.unit)));

  return (
    <div className="tw-modal-overlay" onClick={onClose}>
      <div
        className="tw-modal"
        style={{ maxWidth: 480 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="tw-modal-head">
          <div className="tw-display" style={{ fontSize: 18, fontWeight: 600 }}>
            Edit user
          </div>
          <button className="tw-iconbtn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="tw-modal-body">
          <div style={{ marginBottom: 12 }}>
            <label className="tw-label">Full name</label>
            <input
              className="tw-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {isDuplicate && (
              <div
                style={{
                  fontSize: 11.5,
                  color: 'var(--tw-seal)',
                  marginTop: 4,
                }}
              >
                A user with this name already exists.
              </div>
            )}
          </div>

          <div style={{ marginBottom: 12 }}>
            <label className="tw-label">Designation (optional)</label>
            <DesignationPicker
              value={designation}
              onChange={setDesignation}
              allDesignations={allDesignations || DESIGNATION_HIERARCHY}
              onCreateDesignation={addDesignationIfNew}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label className="tw-label" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 0 }}>
                <span>WhatsApp Mobile Number (India +91)</span>
                <span style={{ fontSize: 10, color: 'var(--tw-ink-soft)', fontWeight: 400 }}>
                  (for 1-click direct dispatch)
                </span>
              </label>
              {phone && (
                <button
                  type="button"
                  style={{
                    fontSize: 11,
                    color: 'var(--tw-seal)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                  onClick={() => setPhone('')}
                  title="Clear phone number"
                >
                  Clear Number
                </button>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'stretch' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                  padding: '0 8px',
                  background: '#ECFDF5',
                  border: '1px solid #10B981',
                  borderRight: 'none',
                  borderRadius: '6px 0 0 6px',
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#065F46',
                  fontFamily: 'IBM Plex Mono, monospace',
                  whiteSpace: 'nowrap',
                }}
                title="Default Indian WhatsApp Prefix (+91)"
              >
                🇮🇳 +91
              </div>
              <input
                type="tel"
                className="tw-input"
                style={{ borderRadius: '0 6px 6px 0', fontSize: 13, fontWeight: 600, color: '#065F46' }}
                value={extractIndianMobileDigits(phone)}
                onChange={(e) => {
                  const raw = extractIndianMobileDigits(e.target.value);
                  setPhone(raw ? formatIndianPhoneNumber(raw) : '');
                }}
                placeholder="10-digit mobile (e.g. 98220 12345)"
              />
            </div>
          </div>

          {isAdmin ? (
            <div
              style={{
                marginBottom: 18,
                fontSize: 12,
                color: 'var(--tw-ink-soft)',
              }}
            >
              Role: Executive Engineer (Admin) — fixed, and not tied to a unit.
            </div>
          ) : (
            <div style={{ marginBottom: 18 }}>
              <MembershipEditor
                units={units}
                memberships={memberships}
                setMemberships={setMemberships}
              />
            </div>
          )}

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
              onClick={() =>
                onSave({
                  ...user,
                  name: name.trim(),
                  designation: designation.trim(),
                  phone: phone.trim() ? formatIndianPhoneNumber(phone) : undefined,
                  role: isAdmin
                    ? 'admin'
                    : memberships[0]?.role || 'member',
                  unit: isAdmin ? null : memberships[0]?.unit || null,
                  memberships: isAdmin ? [] : memberships,
                })
              }
            >
              <Pencil size={15} /> Save changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
