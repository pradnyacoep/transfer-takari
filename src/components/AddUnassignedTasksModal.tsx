import React, { useState, useMemo } from 'react';
import {
  X,
  Search,
  CheckSquare,
  Square,
  Layers,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Building2,
  Filter,
} from 'lucide-react';
import { Task, User } from '../types';
import { getTaskPackage, getPackageBadgeColor } from '../utils/schemePackage';
import { STATUS_LABEL, STATUS_COLOR } from '../constants';
import { matchesTaskSearch } from '../utils/helpers';

interface AddUnassignedTasksModalProps {
  packageName: string;
  allTasks: Task[];
  users: User[];
  units: string[];
  currentUser: User;
  onClose: () => void;
  onAssignTasks: (taskIds: string[], targetPackage: string) => Promise<void> | void;
  flash?: (msg: string) => void;
}

export function AddUnassignedTasksModal({
  packageName,
  allTasks,
  users,
  units,
  currentUser,
  onClose,
  onAssignTasks,
  flash,
}: AddUnassignedTasksModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUnit, setSelectedUnit] = useState<string>('ALL');
  const [selectedPriority, setSelectedPriority] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. Identify all unassigned tasks in the registry
  const unassignedTasks = useMemo(() => {
    return allTasks.filter((t) => !getTaskPackage(t));
  }, [allTasks]);

  // 2. Filter unassigned tasks based on user inputs
  const filteredTasks = useMemo(() => {
    return unassignedTasks.filter((t) => {
      // Unit filter
      if (selectedUnit !== 'ALL') {
        const taskUnits = t.units && t.units.length > 0 ? t.units : t.unit ? [t.unit] : [];
        if (!taskUnits.includes(selectedUnit)) {
          return false;
        }
      }

      // Priority filter
      if (selectedPriority !== 'ALL' && t.priority !== selectedPriority) {
        return false;
      }

      // Status filter
      if (selectedStatus !== 'ALL' && t.status !== selectedStatus) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        return matchesTaskSearch(t, searchQuery, users);
      }

      return true;
    });
  }, [unassignedTasks, selectedUnit, selectedPriority, selectedStatus, searchQuery, users]);

  // Available units that have unassigned tasks
  const availableUnits = useMemo(() => {
    const set = new Set<string>();
    unassignedTasks.forEach((t) => {
      if (t.units) t.units.forEach((u) => set.add(u));
      if (t.unit) set.add(t.unit);
    });
    return Array.from(set);
  }, [unassignedTasks]);

  // Toggle single task
  const toggleTask = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Toggle all filtered tasks
  const allFilteredSelected =
    filteredTasks.length > 0 && filteredTasks.every((t) => selectedIds.has(t.id));

  const toggleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      // Deselect all filtered
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredTasks.forEach((t) => next.delete(t.id));
        return next;
      });
    } else {
      // Select all filtered
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredTasks.forEach((t) => next.add(t.id));
        return next;
      });
    }
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  // Handle Assign confirmation
  const handleAssign = async () => {
    if (selectedIds.size === 0) return;
    setIsSubmitting(true);
    try {
      await onAssignTasks(Array.from(selectedIds), packageName);
      flash && flash(`✓ Successfully added ${selectedIds.size} task(s) to "${packageName}".`);
      onClose();
    } catch (err: any) {
      console.error('Error assigning tasks to package:', err);
      flash && flash(`Error: ${err?.message || 'Failed to assign tasks'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const pkgBadgeColor = getPackageBadgeColor(packageName);

  return (
    <div
      className="tw-modal-backdrop"
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(3px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        className="tw-modal-box"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--tw-card)',
          color: 'var(--tw-ink)',
          borderRadius: 14,
          boxShadow: '0 20px 45px rgba(0,0,0,0.3)',
          border: '1px solid var(--tw-border)',
          width: '100%',
          maxWidth: 780,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'fadeInScale 0.2s ease',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--tw-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--tw-card-alt, #fafbfc)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: pkgBadgeColor,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
              }}
            >
              <Layers size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h3
                  style={{
                    margin: 0,
                    fontSize: 16,
                    fontWeight: 700,
                    color: 'var(--tw-ink)',
                  }}
                >
                  Add Unassigned Tasks
                </h3>
                <span
                  style={{
                    background: pkgBadgeColor,
                    color: '#fff',
                    padding: '2px 9px',
                    borderRadius: 12,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.3px',
                  }}
                >
                  {packageName}
                </span>
              </div>
              <p
                style={{
                  margin: '2px 0 0',
                  fontSize: 12,
                  color: 'var(--tw-ink-soft)',
                }}
              >
                Select tasks below with checkboxes to assign them to contract package{' '}
                <strong>{packageName}</strong>.
              </p>
            </div>
          </div>

          <button
            type="button"
            className="tw-icon-btn"
            onClick={onClose}
            style={{
              padding: 6,
              borderRadius: 8,
              border: 'none',
              background: 'transparent',
              color: 'var(--tw-ink-soft)',
              cursor: 'pointer',
            }}
            title="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Filters and Search Bar */}
        <div
          style={{
            padding: '12px 20px',
            borderBottom: '1px solid var(--tw-border)',
            background: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {/* Search Row */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div
              style={{
                flex: 1,
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Search
                size={15}
                color="var(--tw-steel)"
                style={{ position: 'absolute', left: 10 }}
              />
              <input
                type="text"
                className="tw-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search unassigned tasks by title, ID, unit, or priority..."
                style={{
                  width: '100%',
                  paddingLeft: 32,
                  fontSize: 12.5,
                  height: 34,
                  borderRadius: 8,
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: 8,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--tw-steel)',
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Selection stats badge */}
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: selectedIds.size > 0 ? 'var(--tw-primary, #1E40AF)' : 'var(--tw-ink-soft)',
                background: selectedIds.size > 0 ? '#EFF6FF' : '#F1F5F9',
                padding: '6px 12px',
                borderRadius: 8,
                whiteSpace: 'nowrap',
                border: selectedIds.size > 0 ? '1px solid #BFDBFE' : '1px solid #E2E8F0',
              }}
            >
              {selectedIds.size} of {unassignedTasks.length} selected
            </div>
          </div>

          {/* Filter Pills */}
          <div
            style={{
              display: 'flex',
              gap: 12,
              alignItems: 'center',
              flexWrap: 'wrap',
              fontSize: 11.5,
            }}
          >
            {/* Unit Filter */}
            {availableUnits.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ color: 'var(--tw-ink-soft)', fontWeight: 600 }}>Unit:</span>
                <select
                  value={selectedUnit}
                  onChange={(e) => setSelectedUnit(e.target.value)}
                  style={{
                    fontSize: 11.5,
                    padding: '3px 8px',
                    borderRadius: 6,
                    border: '1px solid var(--tw-border)',
                    background: '#fff',
                    color: 'var(--tw-ink)',
                    cursor: 'pointer',
                  }}
                >
                  <option value="ALL">All Sub-divisions ({unassignedTasks.length})</option>
                  {availableUnits.map((u) => {
                    const count = unassignedTasks.filter(
                      (t) => t.units?.includes(u) || t.unit === u
                    ).length;
                    return (
                      <option key={u} value={u}>
                        {u} ({count})
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            {/* Priority Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ color: 'var(--tw-ink-soft)', fontWeight: 600 }}>Priority:</span>
              <select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value)}
                style={{
                  fontSize: 11.5,
                  padding: '3px 8px',
                  borderRadius: 6,
                  border: '1px solid var(--tw-border)',
                  background: '#fff',
                  color: 'var(--tw-ink)',
                  cursor: 'pointer',
                }}
              >
                <option value="ALL">All Priorities</option>
                <option value="Urgent">Urgent</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>

            {/* Status Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ color: 'var(--tw-ink-soft)', fontWeight: 600 }}>Status:</span>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                style={{
                  fontSize: 11.5,
                  padding: '3px 8px',
                  borderRadius: 6,
                  border: '1px solid var(--tw-border)',
                  background: '#fff',
                  color: 'var(--tw-ink)',
                  cursor: 'pointer',
                }}
              >
                <option value="ALL">All Statuses</option>
                <option value="NOT_STARTED">Not Started</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="UNDER_REVIEW">Under Review</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>

            {/* Clear filters shortcut */}
            {(selectedUnit !== 'ALL' || selectedPriority !== 'ALL' || selectedStatus !== 'ALL' || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedUnit('ALL');
                  setSelectedPriority('ALL');
                  setSelectedStatus('ALL');
                  setSearchQuery('');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#2563EB',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  padding: '2px 4px',
                }}
              >
                Reset filters
              </button>
            )}
          </div>
        </div>

        {/* Multi-Selection Control Bar */}
        <div
          style={{
            padding: '8px 20px',
            background: '#F8FAFC',
            borderBottom: '1px solid var(--tw-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 12,
          }}
        >
          <button
            type="button"
            onClick={toggleSelectAllFiltered}
            disabled={filteredTasks.length === 0}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              background: 'none',
              border: 'none',
              cursor: filteredTasks.length === 0 ? 'not-allowed' : 'pointer',
              color: 'var(--tw-ink)',
              fontWeight: 600,
              padding: '4px 6px',
              borderRadius: 6,
              opacity: filteredTasks.length === 0 ? 0.5 : 1,
            }}
          >
            {allFilteredSelected ? (
              <CheckSquare size={17} color="#2563EB" />
            ) : (
              <Square size={17} color="var(--tw-steel)" />
            )}
            <span>
              {allFilteredSelected ? 'Deselect All Filtered' : `Select All (${filteredTasks.length})`}
            </span>
          </button>

          {selectedIds.size > 0 && (
            <button
              type="button"
              onClick={handleClearSelection}
              style={{
                background: 'none',
                border: 'none',
                color: '#DC2626',
                cursor: 'pointer',
                fontSize: 11.5,
                fontWeight: 600,
                padding: '3px 8px',
                borderRadius: 4,
              }}
            >
              Clear Selection ({selectedIds.size})
            </button>
          )}
        </div>

        {/* Task List with Tickboxes */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            minHeight: 220,
          }}
        >
          {unassignedTasks.length === 0 ? (
            <div
              style={{
                padding: '40px 20px',
                textAlign: 'center',
                color: 'var(--tw-ink-soft)',
              }}
            >
              <CheckCircle2
                size={38}
                color="#10B981"
                style={{ margin: '0 auto 10px', display: 'block' }}
              />
              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--tw-ink)' }}>
                All tasks are currently assigned!
              </div>
              <div style={{ fontSize: 12, marginTop: 4 }}>
                There are no unassigned tasks left in the registry.
              </div>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div
              style={{
                padding: '40px 20px',
                textAlign: 'center',
                color: 'var(--tw-ink-soft)',
              }}
            >
              <AlertCircle
                size={34}
                color="var(--tw-steel)"
                style={{ margin: '0 auto 10px', display: 'block' }}
              />
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--tw-ink)' }}>
                No unassigned tasks found matching your criteria
              </div>
              <div style={{ fontSize: 12, marginTop: 4 }}>
                Try adjusting your search query or reset the filters.
              </div>
            </div>
          ) : (
            filteredTasks.map((task) => {
              const isChecked = selectedIds.has(task.id);
              const priorityColor =
                task.priority === 'Urgent'
                  ? '#DC2626'
                  : task.priority === 'High'
                  ? '#EA580C'
                  : task.priority === 'Medium'
                  ? '#D97706'
                  : '#475569';

              const unitName =
                task.units && task.units.length > 0
                  ? task.units.join(', ')
                  : task.unit || 'General';

              return (
                <div
                  key={task.id}
                  onClick={() => toggleTask(task.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: isChecked ? '1px solid #3B82F6' : '1px solid var(--tw-border)',
                    background: isChecked ? '#EFF6FF' : '#ffffff',
                    cursor: 'pointer',
                    transition: 'all 0.12s ease',
                  }}
                >
                  {/* Tickbox / Checkbox */}
                  <div
                    style={{
                      paddingTop: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}} // Controlled via row click
                      style={{
                        width: 17,
                        height: 17,
                        cursor: 'pointer',
                        accentColor: '#1D4ED8',
                      }}
                    />
                  </div>

                  {/* Task details */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        flexWrap: 'wrap',
                        marginBottom: 3,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: 4,
                          background: '#E2E8F0',
                          color: '#334155',
                          fontFamily: 'monospace',
                        }}
                      >
                        {task.id}
                      </span>

                      {/* Sub-division / Unit */}
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 600,
                          padding: '1px 7px',
                          borderRadius: 10,
                          background: '#F1F5F9',
                          color: '#0F172A',
                          border: '1px solid #CBD5E1',
                        }}
                      >
                        {unitName}
                      </span>

                      {/* Priority pill */}
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: 10,
                          color: priorityColor,
                          border: `1px solid ${priorityColor}44`,
                          background: `${priorityColor}11`,
                        }}
                      >
                        {task.priority || 'Normal'}
                      </span>

                      {/* Status pill */}
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          padding: '1px 6px',
                          borderRadius: 10,
                          background: (STATUS_COLOR[task.status] || '#64748B') + '15',
                          color: STATUS_COLOR[task.status] || '#64748B',
                        }}
                      >
                        {STATUS_LABEL[task.status] || task.status}
                      </span>
                    </div>

                    {/* Task Title */}
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: 'var(--tw-ink)',
                        lineHeight: 1.35,
                      }}
                    >
                      {task.title}
                    </div>

                    {/* Meta info: deadline / follow-up */}
                    {(task.nextFollowUpDate || task.deadline || task.pendingAtOffice) && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          marginTop: 4,
                          fontSize: 11,
                          color: 'var(--tw-ink-soft)',
                          flexWrap: 'wrap',
                        }}
                      >
                        {task.nextFollowUpDate && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <Calendar size={11} /> Follow-up: {task.nextFollowUpDate}
                          </span>
                        )}
                        {task.deadline && (
                          <span>Deadline: {task.deadline}</span>
                        )}
                        {task.pendingAtOffice && (
                          <span>Pending at: {task.pendingAtOffice}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer with Actions */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--tw-border)',
            background: 'var(--tw-card-alt, #fafbfc)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ fontSize: 12.5, color: 'var(--tw-ink)' }}>
            <strong>{selectedIds.size}</strong> task(s) selected
            {selectedIds.size > 0 && (
              <span style={{ color: 'var(--tw-ink-soft)', marginLeft: 6 }}>
                will be assigned to <strong>{packageName}</strong>
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button
              type="button"
              className="tw-btn"
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                fontSize: 12.5,
              }}
            >
              Cancel
            </button>

            <button
              type="button"
              className="tw-btn tw-btn-primary"
              onClick={handleAssign}
              disabled={selectedIds.size === 0 || isSubmitting}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 18px',
                borderRadius: 8,
                fontSize: 12.5,
                fontWeight: 600,
                opacity: selectedIds.size === 0 || isSubmitting ? 0.6 : 1,
                cursor: selectedIds.size === 0 || isSubmitting ? 'not-allowed' : 'pointer',
                background: selectedIds.size > 0 ? pkgBadgeColor : undefined,
                borderColor: selectedIds.size > 0 ? pkgBadgeColor : undefined,
              }}
            >
              <CheckSquare size={15} />
              {isSubmitting
                ? 'Assigning tasks...'
                : `Assign ${selectedIds.size} Tasks to ${packageName}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
