import React, { useState } from 'react';
import {
  Users,
  Building2,
  Tag as TagIcon,
  Plus,
  Pencil,
  Eye,
  Trash2,
  ChevronDown,
  ChevronRight,
  X,
  Layers,
  Phone,
  MessageCircle,
  BookmarkCheck,
  Check,
  RotateCcw,
  AlertTriangle,
} from 'lucide-react';
import { User, Task, OfficeContact } from '../types';
import { DESIGNATION_HIERARCHY, ROLE_LABEL } from '../constants';
import {
  designationRank,
  userMemberships,
  sectionHeadsForUnits,
  assigneesForUnits,
} from '../utils/helpers';
import { getPackageBadgeColor, getTaskPackage } from '../utils/schemePackage';
import { formatIndianPhoneNumber, extractIndianMobileDigits } from '../utils/phoneUtils';
import { NewUserModal } from './NewUserModal';
import { EditUserModal } from './EditUserModal';

export function AdminPanel({
  users,
  units,
  persistUsers,
  persistUnits,
  designations,
  addDesignationIfNew,
  tags,
  addTagIfNew,
  deleteTag,
  pendingOffices,
  addPendingOfficeIfNew,
  deletePendingOffice,
  packages = [],
  addPackageIfNew,
  deletePackage,
  tasks,
  persistTasks,
  flash,
  showNewUser,
  setShowNewUser,
  officeContacts = {},
  onSaveOfficeContact,
  onClearAllOfficePhones,
  onFactoryReset,
}: {
  users: User[];
  units: string[];
  persistUsers: (users: User[]) => Promise<void> | void;
  persistUnits: (units: string[]) => Promise<void> | void;
  designations: string[];
  addDesignationIfNew?: (d: string) => Promise<void>;
  tags: string[];
  addTagIfNew?: (tag: string, currentTags: string[]) => Promise<string[] | void>;
  deleteTag?: (tagName: string) => Promise<void> | void;
  pendingOffices: string[];
  addPendingOfficeIfNew?: (office: string) => Promise<void>;
  deletePendingOffice?: (officeName: string) => Promise<void> | void;
  packages?: string[];
  addPackageIfNew?: (pkgName: string) => Promise<void>;
  deletePackage?: (pkgName: string) => Promise<void> | void;
  tasks: Task[];
  persistTasks: (tasks: Task[]) => Promise<void> | void;
  flash: (msg: string) => void;
  showNewUser: boolean;
  setShowNewUser: (show: boolean) => void;
  officeContacts?: Record<string, OfficeContact>;
  onSaveOfficeContact?: (office: string, contact: OfficeContact) => Promise<void> | void;
  onClearAllOfficePhones?: () => Promise<void> | void;
  onFactoryReset?: () => Promise<void> | void;
}) {
  const [newUnit, setNewUnit] = useState('');
  const [confirmFactoryReset, setConfirmFactoryReset] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [expandedUnit, setExpandedUnit] = useState<string | null>(null);
  const [confirmDeleteTag, setConfirmDeleteTag] = useState<string | null>(null);
  const [newTag, setNewTag] = useState('');
  const [newOffice, setNewOffice] = useState('');
  const [confirmDeleteOffice, setConfirmDeleteOffice] = useState<string | null>(
    null
  );
  const [newPackage, setNewPackage] = useState('');
  const [confirmDeletePackage, setConfirmDeletePackage] = useState<string | null>(
    null
  );
  const [confirmDeleteUnit, setConfirmDeleteUnit] = useState<string | null>(
    null
  );
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<string | null>(
    null
  );
  const [editingOfficeContact, setEditingOfficeContact] = useState<{
    office: string;
    contactPerson: string;
    phone: string;
    notes: string;
  } | null>(null);
  const [newOfficeContactPerson, setNewOfficeContactPerson] = useState('');
  const [newOfficePhone, setNewOfficePhone] = useState('');
  const [confirmClearOfficePhones, setConfirmClearOfficePhones] = useState(false);

  const allDesignations = DESIGNATION_HIERARCHY.concat(
    (designations || []).filter((d) => !DESIGNATION_HIERARCHY.includes(d))
  );

  const sortedUsers = [...users].sort((a, b) => {
    const ra = designationRank(a);
    const rb = designationRank(b);
    if (ra !== rb) return ra - rb;
    return a.name.localeCompare(b.name);
  });

  const addUnit = async () => {
    const clean = newUnit.trim();
    if (!clean) return;
    if (units.some((u) => u.toLowerCase() === clean.toLowerCase())) {
      flash('A unit with this name already exists.');
      return;
    }
    await persistUnits([...units, clean]);
    setNewUnit('');
    flash('Unit added.');
  };

  const removeUnit = async (u: string) => {
    await persistUnits(units.filter((x) => x !== u));
    if (expandedUnit === u) setExpandedUnit(null);
    setConfirmDeleteUnit(null);
    flash(`Unit "${u}" removed.`);
  };

  const toggleActive = async (id: string) => {
    await persistUsers(
      users.map((u) =>
        u.id === id ? { ...u, active: u.active === false ? true : false } : u
      )
    );
  };

  const removeUser = async (id: string, name: string) => {
    await persistUsers(users.filter((u) => u.id !== id));
    if (persistTasks && tasks) {
      const affected = tasks.filter(
        (t) =>
          (t.assigneeIds || []).includes(id) ||
          (t.pendingAt || []).includes(name)
      );
      if (affected.length > 0) {
        const nextTasks = tasks.map((t) => {
          if (
            !(t.assigneeIds || []).includes(id) &&
            !(t.pendingAt || []).includes(name)
          )
            return t;
          return {
            ...t,
            assigneeIds: (t.assigneeIds || []).filter((aid) => aid !== id),
            pendingAt: (t.pendingAt || []).filter((v) => v !== name),
          };
        });
        await persistTasks(nextTasks);
      }
    }
    setConfirmDeleteUser(null);
    flash(`${name} removed from roster.`);
  };

  const addTag = async () => {
    const clean = newTag.trim();
    if (!clean) return;
    if (
      (tags || []).some((t) => t.toLowerCase() === clean.toLowerCase())
    ) {
      flash('This tag already exists.');
      return;
    }
    if (addTagIfNew) {
      await addTagIfNew(clean, tags || []);
    }
    setNewTag('');
    flash('Tag added.');
  };

  const addOffice = async () => {
    const clean = newOffice.trim();
    if (!clean) return;
    if (
      (pendingOffices || []).some(
        (o) => o.toLowerCase() === clean.toLowerCase()
      )
    ) {
      flash('This office already exists.');
      return;
    }
    if (addPendingOfficeIfNew) {
      await addPendingOfficeIfNew(clean);
    }
    const formattedPhone = newOfficePhone.trim() ? formatIndianPhoneNumber(newOfficePhone) : '';
    if ((formattedPhone || newOfficeContactPerson.trim()) && onSaveOfficeContact) {
      await onSaveOfficeContact(clean, {
        phone: formattedPhone || undefined,
        contactPerson: newOfficeContactPerson.trim() || undefined,
      });
    }
    setNewOffice('');
    setNewOfficeContactPerson('');
    setNewOfficePhone('');
    flash('Office added to directory.');
  };

  const handleSaveEditedContact = async () => {
    if (!editingOfficeContact || !onSaveOfficeContact) return;
    const formattedPhone = editingOfficeContact.phone.trim() ? formatIndianPhoneNumber(editingOfficeContact.phone) : '';
    await onSaveOfficeContact(editingOfficeContact.office, {
      contactPerson: editingOfficeContact.contactPerson.trim() || undefined,
      phone: formattedPhone || undefined,
      notes: editingOfficeContact.notes.trim() || undefined,
    });
    flash(`Contact details updated for "${editingOfficeContact.office}".`);
    setEditingOfficeContact(null);
  };

  const addPackage = async () => {
    const clean = newPackage.trim();
    if (!clean) return;
    if (
      (packages || []).some(
        (p) => p.toLowerCase() === clean.toLowerCase()
      )
    ) {
      flash('This package already exists.');
      return;
    }
    if (addPackageIfNew) {
      await addPackageIfNew(clean);
    }
    setNewPackage('');
    flash('Package added.');
  };

  return (
    <div>
      <div
        className="tw-display"
        style={{
          fontSize: 24,
          fontWeight: 600,
          marginBottom: 18,
          color: 'var(--tw-ink)',
        }}
      >
        Admin — Users & Units
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.4fr 1fr',
          gap: 20,
        }}
      >
        <div>
          <div className="tw-section-title">
            <Users size={16} /> Team roster
          </div>
          <div className="tw-card" style={{ marginBottom: 14 }}>
            <table className="tw-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>Sr. No.</th>
                  <th>Name</th>
                  <th>Assignments</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sortedUsers.map((u, idx) => (
                  <tr key={u.id}>
                    <td
                      className="tw-mono"
                      style={{ fontSize: 11.5, color: 'var(--tw-ink-soft)' }}
                    >
                      {idx + 1}
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {u.name}
                      {u.designation ? (
                        <div
                          className="tw-mono"
                          style={{
                            fontSize: 10.5,
                            color: 'var(--tw-ink-soft)',
                            fontWeight: 400,
                          }}
                        >
                          {u.designation}
                        </div>
                      ) : null}
                      {u.phone ? (
                        <div
                          style={{
                            fontSize: 11,
                            color: '#059669',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            marginTop: 3,
                          }}
                          title="WhatsApp direct contact"
                        >
                          <MessageCircle size={11} /> {formatIndianPhoneNumber(u.phone)}
                        </div>
                      ) : (
                        <div
                          style={{
                            fontSize: 10.5,
                            color: 'var(--tw-ink-soft)',
                            marginTop: 2,
                            fontStyle: 'italic',
                          }}
                        >
                          No WhatsApp set
                        </div>
                      )}
                    </td>
                    <td style={{ fontSize: 12.5 }}>
                      {u.role === 'admin' ? (
                        <span>{ROLE_LABEL.admin}</span>
                      ) : (
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 2,
                          }}
                        >
                          {userMemberships(u).length === 0 && (
                            <span style={{ color: 'var(--tw-ink-soft)' }}>
                              No unit assigned
                            </span>
                          )}
                          {userMemberships(u).map((m, i) => (
                            <span
                              key={i}
                              className="tw-mono"
                              style={{ fontSize: 11 }}
                            >
                              {m.role === 'section_head'
                                ? 'Section Head'
                                : 'Member'}{' '}
                              · {m.unit}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td>
                      {u.active === false ? (
                        <span style={{ color: 'var(--tw-ink-soft)' }}>
                          Inactive
                        </span>
                      ) : (
                        <span style={{ color: 'var(--tw-green)' }}>Active</span>
                      )}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {confirmDeleteUser === u.id ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          <span
                            style={{ fontSize: 11, color: 'var(--tw-seal)' }}
                          >
                            Remove {u.name}?
                          </span>
                          <button
                            type="button"
                            className="tw-btn tw-btn-seal"
                            style={{ padding: '2px 8px', fontSize: 11 }}
                            onClick={() => removeUser(u.id, u.name)}
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            className="tw-iconbtn"
                            onClick={() => setConfirmDeleteUser(null)}
                          >
                            <X size={13} />
                          </button>
                        </span>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="tw-iconbtn"
                            onClick={() => setEditingUser(u)}
                            title="Edit user"
                          >
                            <Pencil size={14} />
                          </button>
                          {u.role !== 'admin' && (
                            <>
                              <button
                                type="button"
                                className="tw-iconbtn"
                                onClick={() => toggleActive(u.id)}
                                title="Toggle active"
                              >
                                <Eye size={14} />
                              </button>
                              <button
                                type="button"
                                className="tw-iconbtn"
                                onClick={() => setConfirmDeleteUser(u.id)}
                                title="Remove"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            className="tw-btn"
            onClick={() => setShowNewUser(true)}
          >
            <Plus size={15} /> Add user
          </button>
        </div>

        <div>
          <div className="tw-section-title">
            <Building2 size={16} /> Units / sections
          </div>
          <div
            className="tw-card"
            style={{ padding: 0, marginBottom: 12, overflow: 'hidden' }}
          >
            <table className="tw-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>Sr. No.</th>
                  <th>Unit / Section</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {units.map((u, idx) => {
                  const heads = sectionHeadsForUnits(users, [u]);
                  const members = assigneesForUnits(users, [u]);
                  const isOpen = expandedUnit === u;
                  return (
                    <React.Fragment key={u}>
                      <tr>
                        <td
                          className="tw-mono"
                          style={{
                            fontSize: 11.5,
                            color: 'var(--tw-ink-soft)',
                          }}
                        >
                          {idx + 1}
                        </td>
                        <td
                          style={{ cursor: 'pointer' }}
                          onClick={() =>
                            setExpandedUnit(isOpen ? null : u)
                          }
                        >
                          {isOpen ? (
                            <ChevronDown
                              size={13}
                              style={{
                                verticalAlign: '-2px',
                                marginRight: 4,
                              }}
                            />
                          ) : (
                            <ChevronRight
                              size={13}
                              style={{
                                verticalAlign: '-2px',
                                marginRight: 4,
                              }}
                            />
                          )}
                          {u}
                        </td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {confirmDeleteUnit === u ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 11,
                                  color: 'var(--tw-seal)',
                                }}
                              >
                                Remove?
                              </span>
                              <button
                                type="button"
                                className="tw-btn tw-btn-seal"
                                style={{ padding: '2px 8px', fontSize: 11 }}
                                onClick={() => removeUnit(u)}
                              >
                                Confirm
                              </button>
                              <button
                                type="button"
                                className="tw-iconbtn"
                                onClick={() => setConfirmDeleteUnit(null)}
                              >
                                <X size={13} />
                              </button>
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="tw-iconbtn"
                              onClick={() => setConfirmDeleteUnit(u)}
                              title="Remove unit"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                      {isOpen && (
                        <tr>
                          <td></td>
                          <td
                            colSpan={2}
                            style={{ paddingTop: 2, paddingBottom: 12 }}
                          >
                            <div style={{ fontSize: 11.5 }}>
                              <div style={{ marginBottom: 6 }}>
                                <div
                                  style={{
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.04em',
                                    fontSize: 10,
                                    color: 'var(--tw-ink-soft)',
                                    marginBottom: 3,
                                  }}
                                >
                                  Section Head(s)
                                </div>
                                {heads.length === 0 && (
                                  <div style={{ color: 'var(--tw-ink-soft)' }}>
                                    None assigned
                                  </div>
                                )}
                                {heads.map((h) => (
                                  <div key={h.id}>{h.name}</div>
                                ))}
                              </div>
                              <div>
                                <div
                                  style={{
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.04em',
                                    fontSize: 10,
                                    color: 'var(--tw-ink-soft)',
                                    marginBottom: 3,
                                  }}
                                >
                                  Members
                                </div>
                                {members.length === 0 && (
                                  <div style={{ color: 'var(--tw-ink-soft)' }}>
                                    None assigned
                                  </div>
                                )}
                                {members.map((m) => (
                                  <div key={m.id}>{m.name}</div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div
            style={{
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
            }}
          >
            <div style={{ flex: 1 }}>
              <input
                className="tw-input"
                placeholder="New unit / section name"
                value={newUnit}
                onChange={(e) => setNewUnit(e.target.value)}
              />
              {newUnit.trim() &&
                units.some(
                  (u) => u.toLowerCase() === newUnit.trim().toLowerCase()
                ) && (
                  <div
                    style={{
                      fontSize: 11.5,
                      color: 'var(--tw-seal)',
                      marginTop: 4,
                    }}
                  >
                    A unit with this name already exists.
                  </div>
                )}
            </div>
            <button
              type="button"
              className="tw-btn tw-btn-ghost"
              disabled={
                !newUnit.trim() ||
                units.some(
                  (u) => u.toLowerCase() === newUnit.trim().toLowerCase()
                )
              }
              onClick={addUnit}
            >
              <Plus size={14} />
            </button>
          </div>

          <div style={{ marginTop: 24 }}>
            <div className="tw-section-title">
              <TagIcon size={16} /> Tags
            </div>
            <div className="tw-card" style={{ padding: 14 }}>
              {(!tags || tags.length === 0) && (
                <div
                  style={{
                    fontSize: 12.5,
                    color: 'var(--tw-ink-soft)',
                    marginBottom: 10,
                  }}
                >
                  No tags yet.
                </div>
              )}
              <div
                style={{
                  display: 'flex',
                  gap: 6,
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  marginBottom: 12,
                }}
              >
                {(tags || []).map((tag) =>
                  confirmDeleteTag === tag ? (
                    <div
                      key={tag}
                      className="tw-tag"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '4px 10px',
                        background: 'rgba(178,58,46,0.12)',
                        color: 'var(--tw-seal)',
                      }}
                    >
                      Delete &ldquo;{tag}&rdquo;?
                      <button
                        type="button"
                        className="tw-btn tw-btn-seal"
                        style={{ padding: '2px 8px', fontSize: 11 }}
                        onClick={() => {
                          deleteTag && deleteTag(tag);
                          setConfirmDeleteTag(null);
                          flash(`Tag "${tag}" deleted.`);
                        }}
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        className="tw-iconbtn"
                        onClick={() => setConfirmDeleteTag(null)}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <div
                      key={tag}
                      className="tw-tag"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4px 10px',
                      }}
                    >
                      <TagIcon
                        size={10}
                        style={{ verticalAlign: '-1px' }}
                      />{' '}
                      {tag}
                      <X
                        size={12}
                        style={{ cursor: 'pointer' }}
                        onClick={() => setConfirmDeleteTag(tag)}
                      />
                    </div>
                  )
                )}
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'flex-start',
                }}
              >
                <div style={{ flex: 1 }}>
                  <input
                    className="tw-input"
                    placeholder="New tag name"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addTag()}
                  />
                  {newTag.trim() &&
                    (tags || []).some(
                      (t) => t.toLowerCase() === newTag.trim().toLowerCase()
                    ) && (
                      <div
                        style={{
                          fontSize: 11.5,
                          color: 'var(--tw-seal)',
                          marginTop: 4,
                        }}
                      >
                        This tag already exists.
                      </div>
                    )}
                </div>
                <button
                  type="button"
                  className="tw-btn tw-btn-ghost"
                  disabled={
                    !newTag.trim() ||
                    (tags || []).some(
                      (t) => t.toLowerCase() === newTag.trim().toLowerCase()
                    )
                  }
                  onClick={addTag}
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 24 }}>
            <div className="tw-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Building2 size={16} /> Pending-at Offices &amp; WhatsApp Contacts Directory
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {onClearAllOfficePhones && (
                  confirmClearOfficePhones ? (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#FEE2E2', padding: '2px 8px', borderRadius: 4 }}>
                      <span style={{ fontSize: 11, color: 'var(--tw-seal)' }}>Delete all office numbers?</span>
                      <button
                        type="button"
                        className="tw-btn tw-btn-seal"
                        style={{ padding: '2px 6px', fontSize: 10.5 }}
                        onClick={async () => {
                          await onClearAllOfficePhones();
                          setConfirmClearOfficePhones(false);
                        }}
                      >
                        Confirm Delete
                      </button>
                      <button
                        type="button"
                        className="tw-iconbtn"
                        onClick={() => setConfirmClearOfficePhones(false)}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="tw-btn tw-btn-ghost"
                      style={{
                        fontSize: 11,
                        padding: '3px 8px',
                        color: 'var(--tw-seal)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                      onClick={() => setConfirmClearOfficePhones(true)}
                      title="Delete all preloaded WhatsApp numbers for offices so you can manually enter them"
                    >
                      <Trash2 size={12} /> Delete All Preloaded Numbers
                    </button>
                  )
                )}
                <span style={{ fontSize: 11, color: 'var(--tw-steel)', fontWeight: 400 }}>
                  {pendingOffices?.length || 0} Offices
                </span>
              </div>
            </div>

            <div className="tw-card" style={{ padding: 14 }}>
              {(!pendingOffices || pendingOffices.length === 0) ? (
                <div
                  style={{
                    fontSize: 12.5,
                    color: 'var(--tw-ink-soft)',
                    marginBottom: 10,
                  }}
                >
                  No offices configured in directory yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                  {pendingOffices.map((office) => {
                    const contact = officeContacts[office];
                    const pendingCount = tasks.filter(
                      (t) =>
                        t.status !== 'COMPLETED' &&
                        t.status !== 'ARCHIVED' &&
                        (t.pendingAtOffice === office || (t.pendingAt && t.pendingAt.includes(office)))
                    ).length;

                    return confirmDeleteOffice === office ? (
                      <div
                        key={office}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          background: 'rgba(178,58,46,0.12)',
                          borderRadius: 6,
                          fontSize: 12,
                          color: 'var(--tw-seal)',
                        }}
                      >
                        <span>Delete &ldquo;{office}&rdquo; from directory?</span>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            type="button"
                            className="tw-btn tw-btn-seal"
                            style={{ padding: '2px 8px', fontSize: 11 }}
                            onClick={() => {
                              deletePendingOffice && deletePendingOffice(office);
                              setConfirmDeleteOffice(null);
                              flash(`Office "${office}" deleted.`);
                            }}
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            className="tw-iconbtn"
                            onClick={() => setConfirmDeleteOffice(null)}
                          >
                            <X size={12} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        key={office}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          background: '#F8FAFC',
                          border: '1px solid #E2E8F0',
                          borderRadius: 6,
                          gap: 10,
                        }}
                      >
                        <div style={{ minWidth: 140 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--tw-ink)', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Building2 size={13} color="var(--tw-steel)" /> {office}
                          </div>
                          {pendingCount > 0 ? (
                            <span
                              style={{
                                fontSize: 10.5,
                                color: '#B23A2E',
                                fontWeight: 600,
                              }}
                            >
                              {pendingCount} file{pendingCount > 1 ? 's' : ''} pending
                            </span>
                          ) : (
                            <span style={{ fontSize: 10.5, color: 'var(--tw-ink-soft)' }}>
                              0 files pending
                            </span>
                          )}
                        </div>

                        <div style={{ flex: 1, minWidth: 150 }}>
                          {contact?.contactPerson ? (
                            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--tw-ink)' }}>
                              {contact.contactPerson}
                            </div>
                          ) : (
                            <div style={{ fontSize: 11, color: 'var(--tw-ink-soft)', fontStyle: 'italic' }}>
                              No contact person set
                            </div>
                          )}
                          {contact?.phone ? (
                            <div
                              style={{
                                fontSize: 11,
                                color: '#059669',
                                fontWeight: 600,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                marginTop: 2,
                              }}
                            >
                              <MessageCircle size={11} /> {formatIndianPhoneNumber(contact.phone)}
                            </div>
                          ) : (
                            <button
                              type="button"
                              style={{
                                fontSize: 10.5,
                                color: '#065F46',
                                background: '#ECFDF5',
                                border: '1px dashed #10B981',
                                borderRadius: 4,
                                padding: '2px 8px',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                marginTop: 3,
                                fontWeight: 500,
                              }}
                              onClick={() =>
                                setEditingOfficeContact({
                                  office,
                                  contactPerson: contact?.contactPerson || '',
                                  phone: '',
                                  notes: contact?.notes || '',
                                })
                              }
                              title="Enter WhatsApp number manually (+91 default)"
                            >
                              <Plus size={10} /> Enter WhatsApp Number
                            </button>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <button
                            type="button"
                            className="tw-iconbtn"
                            title="Edit Contact Person & WhatsApp Phone"
                            onClick={() =>
                              setEditingOfficeContact({
                                office,
                                contactPerson: contact?.contactPerson || '',
                                phone: contact?.phone || '',
                                notes: contact?.notes || '',
                              })
                            }
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            type="button"
                            className="tw-iconbtn"
                            title="Remove Office"
                            onClick={() => setConfirmDeleteOffice(office)}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add New Office with Contact Info */}
              <div
                style={{
                  background: '#F1F5F9',
                  border: '1px solid #CBD5E1',
                  borderRadius: 6,
                  padding: 10,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontFamily: 'IBM Plex Mono',
                    fontWeight: 700,
                    color: 'var(--tw-steel)',
                    textTransform: 'uppercase',
                    marginBottom: 6,
                  }}
                >
                  Add New Office Desk &amp; WhatsApp Contact:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr auto', gap: 8, alignItems: 'center' }}>
                  <input
                    className="tw-input"
                    placeholder="Office / Desk Name *"
                    value={newOffice}
                    onChange={(e) => setNewOffice(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addOffice()}
                  />
                  <input
                    className="tw-input"
                    placeholder="Contact Person (e.g. SDO)"
                    value={newOfficeContactPerson}
                    onChange={(e) => setNewOfficeContactPerson(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addOffice()}
                  />
                  <div style={{ display: 'flex', alignItems: 'stretch' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 3,
                        padding: '0 7px',
                        background: '#ECFDF5',
                        border: '1px solid #10B981',
                        borderRight: 'none',
                        borderRadius: '6px 0 0 6px',
                        fontSize: 11.5,
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
                      style={{ borderRadius: '0 6px 6px 0', fontSize: 12.5 }}
                      placeholder="10-digit mobile"
                      value={extractIndianMobileDigits(newOfficePhone)}
                      onChange={(e) => {
                        const raw = extractIndianMobileDigits(e.target.value);
                        setNewOfficePhone(raw ? formatIndianPhoneNumber(raw) : '');
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && addOffice()}
                    />
                  </div>
                  <button
                    type="button"
                    className="tw-btn"
                    disabled={!newOffice.trim()}
                    onClick={addOffice}
                    title="Add office to directory"
                  >
                    <Plus size={14} /> Add
                  </button>
                </div>
                {newOffice.trim() &&
                  (pendingOffices || []).some(
                    (o) => o.toLowerCase() === newOffice.trim().toLowerCase()
                  ) && (
                    <div
                      style={{
                        fontSize: 11.5,
                        color: 'var(--tw-seal)',
                        marginTop: 4,
                      }}
                    >
                      This office already exists in the directory.
                    </div>
                  )}
              </div>
            </div>

            {/* Office Contact Edit Modal */}
            {editingOfficeContact && (
              <div
                className="tw-modal-overlay"
                onClick={() => setEditingOfficeContact(null)}
              >
                <div
                  className="tw-modal"
                  style={{ maxWidth: 440 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="tw-modal-head">
                    <div className="tw-display" style={{ fontSize: 16, fontWeight: 600 }}>
                      Edit Office Contact: {editingOfficeContact.office}
                    </div>
                    <button
                      type="button"
                      className="tw-iconbtn"
                      onClick={() => setEditingOfficeContact(null)}
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <div className="tw-modal-body" style={{ padding: 16 }}>
                    <div style={{ marginBottom: 12 }}>
                      <label className="tw-label">Office / Desk Name</label>
                      <input
                        className="tw-input"
                        disabled
                        value={editingOfficeContact.office}
                        style={{ background: '#F1F5F9', color: '#64748B' }}
                      />
                    </div>
                    <div style={{ marginBottom: 12 }}>
                      <label className="tw-label">Contact Person / Officer</label>
                      <input
                        className="tw-input"
                        placeholder="e.g. SDO Vita / Superintending Engineer (Design)"
                        value={editingOfficeContact.contactPerson}
                        onChange={(e) =>
                          setEditingOfficeContact({
                            ...editingOfficeContact,
                            contactPerson: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <label className="tw-label" style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 0 }}>
                          <Phone size={12} color="#059669" />
                          <span>WhatsApp Mobile Number (India +91)</span>
                        </label>
                        {editingOfficeContact.phone && (
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
                            onClick={() =>
                              setEditingOfficeContact({
                                ...editingOfficeContact,
                                phone: '',
                              })
                            }
                            title="Clear WhatsApp number"
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
                            gap: 4,
                            padding: '0 10px',
                            background: '#ECFDF5',
                            border: '1px solid #10B981',
                            borderRight: 'none',
                            borderRadius: '6px 0 0 6px',
                            fontSize: 12.5,
                            fontWeight: 700,
                            color: '#065F46',
                            fontFamily: 'IBM Plex Mono, monospace',
                            userSelect: 'none',
                            whiteSpace: 'nowrap',
                          }}
                          title="Default Indian WhatsApp Prefix (+91)"
                        >
                          <span style={{ fontSize: 13 }}>🇮🇳</span> +91
                        </div>
                        <input
                          type="tel"
                          className="tw-input"
                          style={{
                            borderRadius: '0 6px 6px 0',
                            fontSize: 13,
                            fontWeight: 600,
                            color: '#065F46',
                          }}
                          placeholder="10-digit mobile (e.g. 98220 12345)"
                          value={extractIndianMobileDigits(editingOfficeContact.phone)}
                          onChange={(e) => {
                            const raw = extractIndianMobileDigits(e.target.value);
                            setEditingOfficeContact({
                              ...editingOfficeContact,
                              phone: raw ? formatIndianPhoneNumber(raw) : '',
                            });
                          }}
                        />
                      </div>
                      <div style={{ fontSize: 10.5, color: 'var(--tw-ink-soft)', marginTop: 4 }}>
                        All WhatsApp numbers use Indian prefix +91 by default.
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      <button
                        type="button"
                        className="tw-btn tw-btn-ghost"
                        onClick={() => setEditingOfficeContact(null)}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="tw-btn"
                        onClick={handleSaveEditedContact}
                      >
                        <Check size={14} /> Save Contact
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div style={{ marginTop: 24 }}>
            <div className="tw-section-title">
              <Layers size={16} /> Packages & Schemes
            </div>
            <div className="tw-card" style={{ padding: 14 }}>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--tw-ink-soft)',
                  marginBottom: 10,
                  lineHeight: 1.4,
                }}
              >
                Create and manage packages (e.g. Package 6A, Package 6B, Palashi Scheme).
                Users can optionally assign tasks to any created package.
              </div>

              {(!packages || packages.length === 0) && (
                <div
                  style={{
                    fontSize: 12.5,
                    color: 'var(--tw-ink-soft)',
                    marginBottom: 10,
                    fontStyle: 'italic',
                  }}
                >
                  No packages created yet. Add your first package below.
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  gap: 6,
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  marginBottom: 12,
                }}
              >
                {(packages || []).map((pkg) => {
                  const pkgColor = getPackageBadgeColor(pkg);
                  const assignedCount = tasks.filter(
                    (t) => getTaskPackage(t)?.toLowerCase() === pkg.toLowerCase()
                  ).length;

                  return confirmDeletePackage === pkg ? (
                    <div
                      key={pkg}
                      className="tw-tag"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '4px 10px',
                        background: 'rgba(178,58,46,0.12)',
                        color: 'var(--tw-seal)',
                      }}
                    >
                      Delete &ldquo;{pkg}&rdquo;?
                      <button
                        type="button"
                        className="tw-btn tw-btn-seal"
                        style={{ padding: '2px 8px', fontSize: 11 }}
                        onClick={() => {
                          deletePackage && deletePackage(pkg);
                          setConfirmDeletePackage(null);
                          flash(`Package "${pkg}" deleted.`);
                        }}
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        className="tw-iconbtn"
                        onClick={() => setConfirmDeletePackage(null)}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <div
                      key={pkg}
                      className="tw-tag"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4px 10px',
                        background: '#FFFFFF',
                        border: `1px solid ${pkgColor}44`,
                        color: pkgColor,
                        fontWeight: 600,
                      }}
                    >
                      <Layers size={11} color={pkgColor} />
                      {pkg}
                      <span
                        className="tw-mono"
                        style={{
                          fontSize: 10,
                          background: `${pkgColor}18`,
                          padding: '1px 5px',
                          borderRadius: 10,
                        }}
                        title={`${assignedCount} task(s) assigned to this package`}
                      >
                        {assignedCount}
                      </span>
                      <X
                        size={12}
                        style={{ cursor: 'pointer', opacity: 0.7 }}
                        onClick={() => setConfirmDeletePackage(pkg)}
                      />
                    </div>
                  );
                })}
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'flex-start',
                }}
              >
                <div style={{ flex: 1 }}>
                  <input
                    className="tw-input"
                    placeholder="New package name (e.g. Package 6A, Palashi Scheme)"
                    value={newPackage}
                    onChange={(e) => setNewPackage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addPackage()}
                  />
                  {newPackage.trim() &&
                    (packages || []).some(
                      (p) =>
                        p.toLowerCase() === newPackage.trim().toLowerCase()
                    ) && (
                      <div
                        style={{
                          fontSize: 11.5,
                          color: 'var(--tw-seal)',
                          marginTop: 4,
                        }}
                      >
                        This package already exists.
                      </div>
                    )}
                </div>
                <button
                  type="button"
                  className="tw-btn tw-btn-ghost"
                  disabled={
                    !newPackage.trim() ||
                    (packages || []).some(
                      (p) =>
                        p.toLowerCase() === newPackage.trim().toLowerCase()
                    )
                  }
                  onClick={addPackage}
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Partial Factory Reset for New Executive Engineer */}
      {onFactoryReset && (
        <div style={{ marginTop: 24 }}>
          <div
            className="tw-card"
            style={{
              padding: '18px 22px',
              border: '1px solid #fed7aa',
              backgroundColor: '#fffbeb',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 14,
              }}
            >
              <div>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: 14.5,
                    color: '#9a3412',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <RotateCcw size={16} /> Factory Reset (Partial) — Setup for New Executive Engineer
                </div>
                <div style={{ fontSize: 12, color: '#b45309', marginTop: 4, maxWidth: 660 }}>
                  Clears all register tasks, resets the team roster to a clean Executive Engineer admin account, and clears packages. All official tags, pending offices, and application structures remain preserved.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConfirmFactoryReset(true)}
                className="tw-btn"
                style={{
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  padding: '9px 16px',
                  fontSize: 12.5,
                  fontWeight: 600,
                }}
              >
                <RotateCcw size={14} /> Reset Data for New EE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Factory Reset Confirmation Modal */}
      {confirmFactoryReset && (
        <div className="tw-modal-backdrop">
          <div className="tw-modal" style={{ maxWidth: 460 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#dc2626', marginBottom: 12 }}>
              <AlertTriangle size={24} />
              <h3 style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>
                Confirm Partial Factory Reset?
              </h3>
            </div>
            <p style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--tw-ink)' }}>
              Are you sure you want to reset the register for a new Executive Engineer?
            </p>
            <ul style={{ fontSize: 12.5, color: 'var(--tw-ink-soft)', lineHeight: 1.6, paddingLeft: 18, marginTop: 8, marginBottom: 16 }}>
              <li><strong>Delete all tasks:</strong> Office register will be cleared to 0 tasks.</li>
              <li><strong>Reset user roster:</strong> Roster will be reset to a single clean Executive Engineer admin.</li>
              <li><strong>Clear packages:</strong> Custom scheme packages will be cleared.</li>
              <li><strong>Preserve structure:</strong> All tags, pending offices, and directory contacts will be kept intact.</li>
            </ul>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
              <button
                type="button"
                disabled={isResetting}
                onClick={() => setConfirmFactoryReset(false)}
                className="tw-btn tw-btn-ghost"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isResetting}
                onClick={async () => {
                  if (!onFactoryReset) return;
                  setIsResetting(true);
                  try {
                    await onFactoryReset();
                    setConfirmFactoryReset(false);
                  } finally {
                    setIsResetting(false);
                  }
                }}
                className="tw-btn"
                style={{ backgroundColor: '#dc2626', color: '#ffffff', border: 'none' }}
              >
                {isResetting ? 'Resetting…' : 'Yes, Reset Register'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showNewUser && (
        <NewUserModal
          units={units}
          existingUsers={users}
          allDesignations={allDesignations}
          addDesignationIfNew={addDesignationIfNew}
          onClose={() => setShowNewUser(false)}
          onCreate={async (u) => {
            if (
              users.some(
                (x) =>
                  x.name.trim().toLowerCase() ===
                  (u.name || '').trim().toLowerCase()
              )
            ) {
              flash('A user with this name already exists.');
              return;
            }
            await persistUsers([
              ...users,
              {
                id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                active: true,
                name: u.name || '',
                role: u.role || 'member',
                unit: u.unit || null,
                designation: u.designation || '',
                memberships: u.memberships || [],
              },
            ]);
            setShowNewUser(false);
            flash('User added to roster.');
          }}
        />
      )}

      {editingUser && (
        <EditUserModal
          user={editingUser}
          units={units}
          existingUsers={users}
          allDesignations={allDesignations}
          addDesignationIfNew={addDesignationIfNew}
          onClose={() => setEditingUser(null)}
          onSave={async (updated) => {
            if (
              users.some(
                (x) =>
                  x.id !== updated.id &&
                  x.name.trim().toLowerCase() ===
                    updated.name.trim().toLowerCase()
              )
            ) {
              flash('A user with this name already exists.');
              return;
            }
            const oldName = editingUser.name;
            await persistUsers(
              users.map((u) => (u.id === updated.id ? updated : u))
            );
            if (persistTasks && tasks && oldName !== updated.name) {
              const affected = tasks.filter((t) =>
                (t.pendingAt || []).includes(oldName)
              );
              if (affected.length > 0) {
                const nextTasks = tasks.map((t) =>
                  (t.pendingAt || []).includes(oldName)
                    ? {
                        ...t,
                        pendingAt: (t.pendingAt || []).map((v) =>
                          v === oldName ? updated.name : v
                        ),
                      }
                    : t
                );
                await persistTasks(nextTasks);
              }
            }
            setEditingUser(null);
            flash('User details updated.');
          }}
        />
      )}
    </div>
  );
}
