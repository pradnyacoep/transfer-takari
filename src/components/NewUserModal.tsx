import React, { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { User, Membership } from '../types';
import { DESIGNATION_HIERARCHY } from '../constants';
import { DesignationPicker, MembershipEditor } from './CommonPickers';
import { formatIndianPhoneNumber, extractIndianMobileDigits } from '../utils/phoneUtils';

export function NewUserModal({
  units,
  existingUsers,
  allDesignations,
  addDesignationIfNew,
  onClose,
  onCreate,
}: {
  units: string[];
  existingUsers: User[];
  allDesignations: string[];
  addDesignationIfNew?: (d: string) => Promise<void>;
  onClose: () => void;
  onCreate: (u: Partial<User>) => Promise<void> | void;
}) {
  const [name, setName] = useState('');
  const [designation, setDesignation] = useState('');
  const [phone, setPhone] = useState('');
  const [memberships, setMemberships] = useState<Membership[]>(
    units.length ? [{ unit: units[0], role: 'member' }] : []
  );

  const isDuplicate =
    name.trim() &&
    (existingUsers || []).some(
      (x) => x.name.trim().toLowerCase() === name.trim().toLowerCase()
    );

  const canSubmit =
    name.trim().length > 0 &&
    !isDuplicate &&
    memberships.length > 0 &&
    memberships.every((m) => m.unit);

  return (
    <div className="tw-modal-overlay" onClick={onClose}>
      <div
        className="tw-modal"
        style={{ maxWidth: 480 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="tw-modal-head">
          <div className="tw-display" style={{ fontSize: 18, fontWeight: 600 }}>
            Add user
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
              placeholder="e.g. S. R. Patil"
              autoFocus
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
            <label className="tw-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>WhatsApp Mobile Number (India +91)</span>
              <span style={{ fontSize: 10, color: 'var(--tw-ink-soft)', fontWeight: 400 }}>
                (for 1-click direct dispatch)
              </span>
            </label>
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

          <div style={{ marginBottom: 18 }}>
            <MembershipEditor
              units={units}
              memberships={memberships}
              setMemberships={setMemberships}
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
              onClick={() =>
                onCreate({
                  name: name.trim(),
                  designation: designation.trim(),
                  phone: phone.trim() ? formatIndianPhoneNumber(phone) : undefined,
                  role: memberships[0]?.role || 'member',
                  unit: memberships[0]?.unit || null,
                  memberships,
                })
              }
            >
              <Plus size={15} /> Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
