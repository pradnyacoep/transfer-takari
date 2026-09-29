import { Task } from '../types';

export interface PendencyAgingInfo {
  office: string | null;
  offices: string[];
  days: number;
  sinceDate: string | null;
  tier: 'green' | 'amber' | 'red_pulse' | 'none';
  tierLabel: string;
  bg: string;
  color: string;
  border: string;
  pulse: boolean;
  reminderTrigger: 'none' | '1st_reminder' | '2nd_reminder';
  reminderLabel: string | null;
  isStalled: boolean;
}

/**
 * Calculates how many days a task / file has been pending at an office.
 */
export function calculatePendencyInfo(task: Task): PendencyAgingInfo {
  const offices = task.pendingAt || [];
  if (offices.length === 0 || task.status === 'COMPLETED' || task.status === 'ARCHIVED') {
    return {
      office: null,
      offices: [],
      days: 0,
      sinceDate: null,
      tier: 'none',
      tierLabel: 'Not Pending',
      bg: '#F3F4F6',
      color: '#6B7280',
      border: '#E5E7EB',
      pulse: false,
      reminderTrigger: 'none',
      reminderLabel: null,
      isStalled: false,
    };
  }

  const primaryOffice = offices[0];

  // Determine start date of pendency at current office
  let startDateStr = task.pendingSince || null;

  if (!startDateStr) {
    // Check remarks for when this office was mentioned
    if (task.comments && task.comments.length > 0) {
      for (const c of task.comments) {
        const text = (c.text || '').toLowerCase();
        if (offices.some((o) => text.includes(o.toLowerCase()))) {
          startDateStr = c.at;
          break;
        }
      }
    }
  }

  // Fallback to task creation date or last follow up
  if (!startDateStr) {
    startDateStr = task.createdAt || null;
  }

  let days = 0;
  if (startDateStr) {
    try {
      const startMs = new Date(startDateStr.slice(0, 10)).getTime();
      const nowMs = new Date().setHours(0, 0, 0, 0);
      if (!isNaN(startMs)) {
        const diffMs = nowMs - startMs;
        days = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
      }
    } catch {
      days = 0;
    }
  }

  // Visual aging badges:
  // Green (0-7 days), Amber (8-21 days), and Red Pulse (21+ days stalled at any office)
  let tier: 'green' | 'amber' | 'red_pulse' = 'green';
  let tierLabel = '0-7d';
  let bg = '#ECFDF5';
  let color = '#065F46';
  let border = '#A7F3D0';
  let pulse = false;

  if (days >= 21) {
    tier = 'red_pulse';
    tierLabel = '21+d Stalled';
    bg = '#FEF2F2';
    color = '#991B1B';
    border = '#F87171';
    pulse = true;
  } else if (days >= 8) {
    tier = 'amber';
    tierLabel = '8-21d';
    bg = '#FFFBEB';
    color = '#92400E';
    border = '#FDE68A';
    pulse = false;
  }

  // Escalation triggers:
  // Past 10 days: 1st Reminder suggested
  // Past 20 days: 2nd Reminder suggested
  let reminderTrigger: 'none' | '1st_reminder' | '2nd_reminder' = 'none';
  let reminderLabel: string | null = null;

  if (days >= 20) {
    reminderTrigger = '2nd_reminder';
    reminderLabel = '2nd Reminder Suggested';
  } else if (days >= 10) {
    reminderTrigger = '1st_reminder';
    reminderLabel = '1st Reminder Suggested';
  }

  return {
    office: primaryOffice,
    offices,
    days,
    sinceDate: startDateStr,
    tier,
    tierLabel,
    bg,
    color,
    border,
    pulse,
    reminderTrigger,
    reminderLabel,
    isStalled: days >= 8,
  };
}

/**
 * Super clean, simple 1-line WhatsApp message generator:
 * - "pl report me on [task name]"
 * - "pl give updates of [task name]"
 * - "what is the status of [task name]?"
 * - "pl update me on [task name]"
 * - "pl take follow up for [task name]"
 */
export function generateWhatsAppMemoTemplate(params: {
  taskTitle: string;
  presetStyle?: 'report' | 'updates' | 'status' | 'update' | 'followup';
}): string {
  const { taskTitle, presetStyle = 'report' } = params;
  const cleanTitle = (taskTitle || 'this task').trim();

  switch (presetStyle) {
    case 'updates':
      return `pl give updates of *${cleanTitle}*.`;
    case 'status':
      return `what is the status of *${cleanTitle}*?`;
    case 'update':
      return `pl update me on *${cleanTitle}*.`;
    case 'followup':
      return `pl take follow up for *${cleanTitle}*.`;
    case 'report':
    default:
      return `pl report me on *${cleanTitle}*.`;
  }
}
