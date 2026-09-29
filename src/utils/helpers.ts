import * as XLSX from 'xlsx';
import {
  DESIGNATION_HIERARCHY,
  FORWARD,
  BACKWARD,
  PB_UNIT_NAME,
  STATUS_LABEL,
} from '../constants';
import { Task, User, Membership, PersonalTask, Comment } from '../types';

export function isFieldOfficeUnit(unitName: unknown): boolean {
  return (
    typeof unitName === 'string' &&
    unitName.trim().toLowerCase().startsWith('sub-division')
  );
}

export function fieldOfficeUnits(units: string[]): string[] {
  return units.filter(isFieldOfficeUnit);
}

export function divisionOfficeUnits(units: string[]): string[] {
  return units.filter((u) => !isFieldOfficeUnit(u));
}

export function uid(prefix: string): string {
  return (
    prefix +
    '_' +
    Math.random().toString(36).slice(2, 9) +
    Date.now().toString(36).slice(-4)
  );
}

export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fmtDate(d?: string | null): string {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function fmtDateTime(d?: string | null): string {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  const datePart = dt.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  let hours = dt.getHours();
  const minutes = String(dt.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const timePart = `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
  return `${datePart}, ${timePart}`;
}

export function combineDateTime(
  dateStr?: string | null,
  timeStr?: string | null
): string | null {
  if (!dateStr) return null;
  const [h, m] = (timeStr || '00:00').split(':').map(Number);
  const d = new Date(`${dateStr}T00:00:00`);
  d.setHours(h || 0, m || 0, 0, 0);
  return d.toISOString();
}

export function currentTimeHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes()
  ).padStart(2, '0')}`;
}

export function fmtDeadline(d?: string | null): string {
  return d ? fmtDate(d) : 'No deadline';
}

export function daysBetween(a: string | Date, b: string | Date): number {
  return Math.round(
    (new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24)
  );
}

export function isOverdue(task: Task): boolean {
  if (!task.deadline) return false;
  if (task.status !== 'NOT_STARTED' && task.status !== 'IN_PROGRESS')
    return false;
  return new Date(task.deadline) < new Date(todayISO());
}

export function isFollowUpDue(task: Task): boolean {
  if (!task.nextFollowUpDate) return false;
  if (task.status === 'COMPLETED' || task.status === 'ARCHIVED') return false;
  const taskDate = task.nextFollowUpDate.slice(0, 10);
  return taskDate <= todayISO();
}

/**
 * Returns color for next follow up date:
 * - If due already: dark red / brown (#8B1E0F)
 * - If not due: vibrant blue (#1D4ED8)
 * - If not set / completed: soft ink
 */
export function getFollowUpColor(task: { nextFollowUpDate?: string | null; status?: string }): string {
  if (!task.nextFollowUpDate) return 'var(--tw-ink-soft)';
  if (task.status === 'COMPLETED' || task.status === 'ARCHIVED') return 'var(--tw-ink-soft)';
  const taskDate = task.nextFollowUpDate.slice(0, 10);
  return taskDate <= todayISO() ? '#8B1E0F' : '#1D4ED8';
}

/**
 * Checks if a query matches task title, ID, description, tags, units,
 * historical remarks and follow-up notes, attachments, and history.
 */
export function matchesTaskSearch(task: Task, query: string, users?: User[]): boolean {
  if (!query || !query.trim()) return true;
  const q = query.trim().toLowerCase();

  // 1. Task title & ID
  if (task.title && task.title.toLowerCase().includes(q)) return true;
  if (task.id && task.id.toLowerCase().includes(q)) return true;

  // 2. Description
  if (task.description && task.description.toLowerCase().includes(q)) return true;

  // 3. Tags
  if ((task.tags || []).some((tag) => tag.toLowerCase().includes(q))) return true;

  // 4. Scheme / Package
  if (task.scheme && task.scheme.toLowerCase().includes(q)) return true;

  // 5. Units & Pending At
  if ((task.units || []).some((u) => u.toLowerCase().includes(q))) return true;
  if (task.unit && task.unit.toLowerCase().includes(q)) return true;
  if ((task.pendingAt || []).some((p) => p.toLowerCase().includes(q))) return true;

  // 6. Assignees
  if (users && task.assigneeIds) {
    const hasAssignee = task.assigneeIds.some((id) => {
      const u = users.find((x) => x.id === id);
      return u && u.name.toLowerCase().includes(q);
    });
    if (hasAssignee) return true;
  }

  // 7. ALL historical remarks & follow-up notes (comments)
  if (task.comments && task.comments.length > 0) {
    const commentMatch = task.comments.some((c) => {
      if (c.text && c.text.toLowerCase().includes(q)) return true;
      if (c.attachments && c.attachments.some((att) => att.name.toLowerCase().includes(q))) return true;
      return false;
    });
    if (commentMatch) return true;
  }

  // 8. Task history status changes
  if (task.history && task.history.length > 0) {
    const historyMatch = task.history.some((h) => {
      return (h.status && h.status.toLowerCase().includes(q)) || (h.by && h.by.toLowerCase().includes(q));
    });
    if (historyMatch) return true;
  }

  return false;
}

export function isFollowUpOverdue(task: Task): boolean {
  if (!task.nextFollowUpDate) return false;
  if (task.status === 'COMPLETED' || task.status === 'ARCHIVED') return false;
  return new Date(task.nextFollowUpDate) < new Date(todayISO());
}

export function addDaysToDate(baseDateStr: string, days: number): string {
  const dt = new Date(baseDateStr);
  if (isNaN(dt.getTime())) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}T05:30:00+05:30`;
  }
  dt.setDate(dt.getDate() + days);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  if (baseDateStr.includes('T')) {
    const timePart = baseDateStr.split('T')[1];
    return `${y}-${m}-${d}T${timePart}`;
  }
  return `${y}-${m}-${d}`;
}

export function postponeDate(baseDateStr: string | null | undefined, days: number): string {
  const today = todayISO();
  let baseStr = baseDateStr;
  if (!baseStr || baseStr.slice(0, 10) < today) {
    baseStr = `${today}T05:30:00+05:30`;
  }
  return addDaysToDate(baseStr, days);
}

export type FollowUpCategory =
  | 'overdue'
  | 'today'
  | 'this_week'
  | 'later_this_month'
  | 'future'
  | 'not_set';

export function getFollowUpCategory(task: Task, todayStr = todayISO()): FollowUpCategory {
  if (task.status === 'COMPLETED' || task.status === 'ARCHIVED') {
    return 'not_set';
  }
  if (!task.nextFollowUpDate) return 'not_set';
  const targetDateStr = task.nextFollowUpDate.slice(0, 10);
  const todayDate = new Date(todayStr + 'T00:00:00');
  const targetDate = new Date(targetDateStr + 'T00:00:00');
  const diffDays = Math.round(
    (targetDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays < 0) return 'overdue';
  if (diffDays === 0) return 'today';
  if (diffDays <= 7) return 'this_week';
  if (
    targetDate.getMonth() === todayDate.getMonth() &&
    targetDate.getFullYear() === todayDate.getFullYear()
  ) {
    return 'later_this_month';
  }
  return 'future';
}

export function getFollowUpCategoryMeta(cat: FollowUpCategory): {
  label: string;
  badge: string;
  color: string;
  bg: string;
  border: string;
} {
  switch (cat) {
    case 'overdue':
      return {
        label: 'Overdue Follow-ups',
        badge: 'Overdue',
        color: '#B23A2E',
        bg: '#FDF2F1',
        border: '#F3C2BE',
      };
    case 'today':
      return {
        label: 'Due Today',
        badge: 'Today',
        color: '#C77D22',
        bg: '#FEF8EE',
        border: '#F6DFB8',
      };
    case 'this_week':
      return {
        label: 'Due This Week (Next 7 Days)',
        badge: 'This Week',
        color: '#2F7A4D',
        bg: '#F1F9F4',
        border: '#C2E6D0',
      };
    case 'later_this_month':
      return {
        label: 'Later This Month',
        badge: 'This Month',
        color: '#3B6E8F',
        bg: '#F0F6FA',
        border: '#C5DDEE',
      };
    case 'future':
      return {
        label: 'Next Month & Beyond',
        badge: 'Future',
        color: '#52525B',
        bg: '#F4F4F5',
        border: '#D4D4D8',
      };
    case 'not_set':
    default:
      return {
        label: 'Follow-up Not Set',
        badge: 'Not Scheduled',
        color: '#71717A',
        bg: '#FAFAFA',
        border: '#E4E4E7',
      };
  }
}


export function isPersonalFollowUpDue(task: PersonalTask): boolean {
  if (!task.nextFollowUpDate) return false;
  if (task.status === 'DONE' || task.status === 'ARCHIVED') return false;
  return new Date(task.nextFollowUpDate) <= new Date(todayISO());
}

export function userMemberships(user?: User | null): Membership[] {
  if (!user) return [];
  if (Array.isArray(user.memberships)) return user.memberships;
  if (user.role === 'admin') return [];
  return user.unit
    ? [{ unit: user.unit, role: (user.role as 'section_head' | 'member') || 'member' }]
    : [];
}

export function unitsHeaded(user?: User | null): string[] {
  return userMemberships(user)
    .filter((m) => m.role === 'section_head')
    .map((m) => m.unit);
}

export function allUnitsOf(user?: User | null): string[] {
  return Array.from(new Set(userMemberships(user).map((m) => m.unit)));
}

export function unitsForRole(
  user: User | null | undefined,
  unitList: string[],
  role: 'section_head' | 'member'
): string[] {
  return userMemberships(user)
    .filter((m) => m.role === role && unitList.includes(m.unit))
    .map((m) => m.unit);
}

export function designationRank(u: User): number {
  if (u.role === 'admin') return -1;
  const idx = DESIGNATION_HIERARCHY.indexOf(u.designation || '');
  return idx === -1 ? DESIGNATION_HIERARCHY.length : idx;
}

export function membershipSummary(user?: User | null): string {
  if (!user) return '';
  if (user.role === 'admin') return 'Executive Engineer (Admin)';
  const m = userMemberships(user);
  if (m.length === 0) return 'No unit assigned';
  return m
    .map(
      (x) =>
        `${x.unit} (${x.role === 'section_head' ? 'Section Head' : 'Member'})`
    )
    .join(', ');
}

export function membershipSummaryShort(user?: User | null): string {
  if (!user) return '';
  if (user.role === 'admin') return 'Executive Engineer (Admin)';
  const m = userMemberships(user);
  if (m.length === 0) return 'No unit assigned';
  if (m.length === 1) {
    return `${m[0].role === 'section_head' ? 'Section Head' : 'Member'} · ${
      m[0].unit
    }`;
  }
  return `${m.length} unit assignments`;
}

export function unitsVisibleTo(user?: User | null, allUnits: string[] = []): string[] | 'ALL' {
  if (!user) return [];
  if (user.role === 'admin') return 'ALL';
  return allUnitsOf(user);
}

export function canSeeTask(user: User | null, task: Task): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  const heads = unitsHeaded(user);
  if ((task.units || []).some((u) => heads.includes(u))) return true;
  return (task.assigneeIds || []).includes(user.id);
}

export function canCreateTasks(user?: User | null): boolean {
  return !!user && (user.role === 'admin' || unitsHeaded(user).length > 0);
}

export function unitsAssignableBy(
  user: User | null | undefined,
  allUnits: string[]
): string[] {
  if (!user) return [];
  if (user.role === 'admin') return allUnits;
  return unitsHeaded(user);
}

export function assigneesForUnits(users: User[], unitList: string[]): User[] {
  return users.filter(
    (u) =>
      u.active !== false &&
      userMemberships(u).some(
        (m) => m.role === 'member' && unitList.includes(m.unit)
      )
  );
}

export function sectionHeadsForUnits(users: User[], unitList: string[]): User[] {
  return users.filter(
    (u) =>
      u.active !== false &&
      userMemberships(u).some(
        (m) => m.role === 'section_head' && unitList.includes(m.unit)
      )
  );
}

export function canEditTask(user: User | null, task: Task): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  const heads = unitsHeaded(user);
  return (task.units || []).some((u) => heads.includes(u));
}

export function canDeleteTask(user: User | null, task: Task): boolean {
  return canEditTask(user, task);
}

export function allowedNextStatuses(user: User | null, task: Task): string[] {
  if (!user) return [];
  const out: string[] = [];
  const fwd = FORWARD[task.status];
  const bwd = BACKWARD[task.status];

  if (user.role === 'admin') {
    if (fwd) out.push(fwd);
    if (bwd) out.push(bwd);
    return out;
  }

  const heads = unitsHeaded(user);
  if ((task.units || []).some((u) => heads.includes(u))) {
    // section head controls review -> completed -> archived, and can send back
    if (task.status === 'UNDER_REVIEW') {
      out.push('COMPLETED');
      out.push('IN_PROGRESS');
    }
    if (task.status === 'COMPLETED') {
      out.push('ARCHIVED');
      out.push('UNDER_REVIEW');
    }
    if (task.status === 'ARCHIVED') {
      out.push('COMPLETED');
    }
    if (task.status === 'NOT_STARTED') out.push('IN_PROGRESS');
    if (task.status === 'IN_PROGRESS') out.push('UNDER_REVIEW');
    return out;
  }

  if ((task.assigneeIds || []).includes(user.id)) {
    if (task.status === 'NOT_STARTED') out.push('IN_PROGRESS');
    if (task.status === 'IN_PROGRESS') out.push('UNDER_REVIEW');
    return out;
  }

  return [];
}

export function exportTasksToExcel(
  taskList: Task[],
  users: User[],
  sheetLabel?: string
): void {
  const rows = taskList.map((t) => {
    const assignees = (t.assigneeIds || [])
      .map((id) => {
        const u = users.find((x) => x.id === id);
        return u ? u.name : '';
      })
      .filter(Boolean)
      .join(', ');

    return {
      Title: t.title,
      Description: t.description || '',
      'Unit(s)': (t.units || []).join(', '),
      Assignees: assignees,
      Priority: t.priority || '',
      Status: STATUS_LABEL[t.status] || t.status,
      'Next Follow-up': t.nextFollowUpDate ? fmtDate(t.nextFollowUpDate) : '',
      'Last Follow-up': t.lastFollowUp ? fmtDateTime(t.lastFollowUp) : '',
      'Pending At': (t.pendingAt || []).join(', '),
      Deadline: t.deadline ? fmtDate(t.deadline) : '',
      Tags: (t.tags || []).join(', '),
      Created: fmtDate(t.createdAt),
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 30 },
    { wch: 34 },
    { wch: 20 },
    { wch: 24 },
    { wch: 10 },
    { wch: 14 },
    { wch: 16 },
    { wch: 18 },
    { wch: 18 },
    { wch: 14 },
    { wch: 20 },
    { wch: 14 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Tasks');
  const dateStamp = todayISO();
  XLSX.writeFile(wb, `${sheetLabel || 'Task Register'} - ${dateStamp}.xlsx`);
}

export function groupTasksByTag(
  tasks: Task[],
  selectedTags: string[]
): {
  sortedTags: string[];
  map: Record<string, Task[]>;
  untagged: Task[];
} {
  const map: Record<string, Task[]> = {};
  const untagged: Task[] = [];

  tasks.forEach((t) => {
    if (!t.tags || t.tags.length === 0) {
      if (selectedTags.length === 0) untagged.push(t);
    } else {
      t.tags.forEach((tag) => {
        if (selectedTags.length > 0 && !selectedTags.includes(tag)) return;
        if (!map[tag]) map[tag] = [];
        map[tag].push(t);
      });
    }
  });

  const sortedTags = Object.keys(map).sort((a, b) => a.localeCompare(b));
  return { sortedTags, map, untagged };
}

export function groupTasksByOffice(
  tasks: Task[],
  selectedOffices: string[]
): {
  sortedOffices: string[];
  map: Record<string, Task[]>;
  unset: Task[];
} {
  const map: Record<string, Task[]> = {};
  const unset: Task[] = [];

  tasks.forEach((t) => {
    const values = t.pendingAt || [];
    if (values.length === 0) {
      if (selectedOffices.length === 0) unset.push(t);
      return;
    }
    values.forEach((office) => {
      if (selectedOffices.length > 0 && !selectedOffices.includes(office)) return;
      if (!map[office]) map[office] = [];
      map[office].push(t);
    });
  });

  const sortedOffices = Object.keys(map).sort((a, b) => a.localeCompare(b));
  return { sortedOffices, map, unset };
}

export function sanitizeComments(comments?: Comment[] | null): Comment[] {
  if (!Array.isArray(comments) || comments.length === 0) return [];

  const seenIds = new Set<string>();
  const seenContent = new Set<string>();
  const sanitized: Comment[] = [];

  for (const c of comments) {
    if (!c) continue;
    const cleanText = (c.text || '').trim();
    const hasAttachments = Array.isArray(c.attachments) && c.attachments.length > 0;
    if (!cleanText && !hasAttachments) continue;

    // Signature based on author + normalized text + attached file names
    const attKey = (c.attachments || []).map((a) => a.name).sort().join(',');
    const simplifiedText = cleanText
      .toLowerCase()
      .replace(/[.\s]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const contentKey = `${(c.userId || '').trim().toLowerCase()}:::${simplifiedText}:::${attKey}`;

    if (seenContent.has(contentKey)) {
      continue;
    }
    seenContent.add(contentKey);

    let commentId = c.id ? String(c.id).trim() : '';
    // If id is missing or has already been used by another comment in this list, generate a fresh unique one
    if (!commentId || seenIds.has(commentId)) {
      commentId = `cm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    }
    seenIds.add(commentId);

    sanitized.push({
      ...c,
      id: commentId,
      text: cleanText,
      attachments: c.attachments || undefined,
    });
  }

  // Sort comments chronologically
  sanitized.sort(
    (a, b) => new Date(a.at || 0).getTime() - new Date(b.at || 0).getTime()
  );
  return sanitized;
}
