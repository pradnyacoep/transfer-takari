import type React from 'react';

export const UNIT_SEED = [
  'Sub-Division No. 6',
  'Sub-Division No. 11',
  'Sub-Division No. 3',
  'Sub-Division No. 9',
  'Sub-Division No. 17',
  'Account Section',
  'Establishment Section',
  'Store Management',
  'Drawing Branch',
  'Tender Section',
  'LAq/ Court Cases',
  'Project Branch',
  'Personal Office Works',
];

export const INITIAL_UNITS = UNIT_SEED;
export const INITIAL_TAGS = [
  'design',
  'LAq',
  'Tender',
  'Establishment',
  'Construction',
  'Prapansuchi',
  'Notes',
  'store',
  'Minutes',
  'water management',
  'forest',
  'Crop Comp',
  'Lok Pratnidhi',
];
export const INITIAL_PENDING_OFFICES = [
  'CDO',
  'EE Mech',
  'SE Sangli',
  'Division',
  'Prant Miraj',
  'CE Kolhapur',
  'Subdivision',
  'Town Planning',
  'Sett',
  'Myself',
  'Designer',
  'Prant Vita',
  'Contractor',
  'Dist.Agri.Office',
  'Store Management',
];

export const DEFAULT_OFFICE_CONTACTS: Record<
  string,
  { phone: string; contactPerson: string }
> = {
  CDO: { phone: '', contactPerson: 'Superintending Engineer (Design)' },
  'EE Mech': { phone: '', contactPerson: 'Executive Engineer (Mechanical)' },
  'SE Sangli': { phone: '', contactPerson: 'Superintending Engineer Office' },
  Division: { phone: '', contactPerson: 'Division Office Desk' },
  'CE Kolhapur': { phone: '', contactPerson: 'Chief Engineer Office' },
  'Prant Miraj': { phone: '', contactPerson: 'Sub-Divisional Magistrate / SDO' },
  Subdivision: { phone: '', contactPerson: 'Sub-Divisional Officer' },
  'Town Planning': { phone: '', contactPerson: 'Town Planning Officer' },
  Contractor: { phone: '', contactPerson: 'Agency Representative' },
  'Dist.Agri.Office': { phone: '', contactPerson: 'District Agriculture Officer' },
  Sett: { phone: '', contactPerson: 'Settlement Officer' },
  Myself: { phone: '', contactPerson: 'Personal Follow-up' },
  Designer: { phone: '', contactPerson: 'Design Consultant Desk' },
  'Prant Vita': { phone: '', contactPerson: 'Sub-Divisional Officer / SDO Vita' },
  'Store Management': { phone: '', contactPerson: 'Division Stores Desk' },
};

export const GROUP_FIELD = 'GROUP_FIELD';
export const GROUP_DIVISION = 'GROUP_DIVISION';

export const STATUSES = [
  'NOT_STARTED',
  'IN_PROGRESS',
  'UNDER_REVIEW',
  'COMPLETED',
  'ARCHIVED',
] as const;

export const STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: 'Not Started',
  IN_PROGRESS: 'In Progress',
  UNDER_REVIEW: 'Under Review',
  COMPLETED: 'Completed',
  ARCHIVED: 'Archived',
};

export const STATUS_COLOR: Record<string, string> = {
  NOT_STARTED: '#8a8478',
  IN_PROGRESS: '#3B6E8F',
  UNDER_REVIEW: '#C77D22',
  COMPLETED: '#2F7A4D',
  ARCHIVED: '#5C5347',
};

export const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'] as const;

export const PRIORITY_COLOR: Record<string, string> = {
  Low: '#5C7A6E',
  Medium: '#3B6E8F',
  High: '#C77D22',
  Urgent: '#B23A2E',
};

export const QUICK_DAY_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 30];

export const ROLE_LABEL: Record<string, string> = {
  admin: 'Executive Engineer (Admin)',
  section_head: 'Section Head',
  member: 'Member',
};

export const DESIGNATION_HIERARCHY = [
  'Executive Engineer',
  'Admin',
  'AEE',
  'AE1',
  'SDE',
  'SDO',
  'Accountant',
  'AE2',
  'SO',
  'JE',
  'HC',
  'SK',
  'Clerk',
  'OA',
  'Steno',
  'ASK',
  'DM',
  'FC',
  'Self',
];

export const INITIAL_DESIGNATIONS = DESIGNATION_HIERARCHY;

export const PB_UNIT_NAME = 'Project Branch';

export const FORWARD: Record<string, string> = {
  NOT_STARTED: 'IN_PROGRESS',
  IN_PROGRESS: 'UNDER_REVIEW',
  UNDER_REVIEW: 'COMPLETED',
  COMPLETED: 'ARCHIVED',
};

export const BACKWARD: Record<string, string> = {
  IN_PROGRESS: 'NOT_STARTED',
  UNDER_REVIEW: 'IN_PROGRESS',
  COMPLETED: 'UNDER_REVIEW',
  ARCHIVED: 'COMPLETED',
};

export const PERSONAL_STATUSES = ['TODO', 'IN_PROGRESS', 'DONE', 'ARCHIVED'] as const;

export const PERSONAL_STATUS_LABEL: Record<string, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  DONE: 'Done',
  ARCHIVED: 'Archived',
};

export const PERSONAL_STATUS_COLOR: Record<string, string> = {
  TODO: '#8a8478',
  IN_PROGRESS: '#3B6E8F',
  DONE: '#2F7A4D',
  ARCHIVED: '#5C5347',
};

export const rootStyle: React.CSSProperties = {
  fontFamily: "'IBM Plex Sans', sans-serif",
  minHeight: '100vh',
  background: 'var(--tw-paper)',
  color: 'var(--tw-ink)',
  position: 'relative',
};

export const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@0,500;0,600;1,500&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

:root {
  --tw-paper: #FAF9F5;
  --tw-paper-deep: #F1EFE7;
  --tw-ink: #1B2A4A;
  --tw-ink-soft: #5A6472;
  --tw-line: #E3E0D6;
  --tw-seal: #B23A2E;
  --tw-steel: #3B6E8F;
  --tw-gold: #C77D22;
  --tw-green: #2F7A4D;
  --tw-shadow-sm: 0 1px 2px rgba(27,42,74,0.05), 0 1px 3px rgba(27,42,74,0.04);
  --tw-shadow-md: 0 2px 6px rgba(27,42,74,0.08), 0 4px 14px rgba(27,42,74,0.06);
  --tw-radius: 9px;
  --tw-radius-sm: 6px;
}

* { box-sizing: border-box; }

.tw-loading {
  padding: 60px;
  text-align: center;
  font-family: 'IBM Plex Mono', monospace;
  color: var(--tw-ink-soft);
}

.tw-display { font-family: 'Newsreader', serif; }
.tw-mono { font-family: 'IBM Plex Mono', monospace; }

/* Register texture background */
.tw-graph-bg {
  background-image:
    linear-gradient(var(--tw-line) 1px, transparent 1px),
    linear-gradient(90deg, var(--tw-line) 1px, transparent 1px);
  background-size: 28px 28px;
  background-color: var(--tw-paper);
}

.tw-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 26px;
  border-bottom: 1px solid var(--tw-line);
  background: var(--tw-paper-deep);
}

.tw-brand { display: flex; align-items: center; gap: 10px; }
.tw-brand-title {
  font-family: 'Newsreader', serif;
  font-weight: 600;
  font-size: 20px;
  color: var(--tw-ink);
  letter-spacing: 0.2px;
}
.tw-brand-sub {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 11px;
  color: var(--tw-ink-soft);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.tw-nav { display: flex; gap: 4px; }
.tw-navbtn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: var(--tw-radius-sm);
  font-size: 13.5px;
  font-weight: 500;
  color: var(--tw-ink-soft);
  cursor: pointer;
  border: 1px solid transparent;
  background: none;
  transition: all .16s ease;
}
.tw-navbtn:hover { background: rgba(27,42,74,0.06); }
.tw-navbtn.active {
  background: var(--tw-ink);
  color: var(--tw-paper);
  box-shadow: var(--tw-shadow-sm);
}

.tw-body { padding: 22px 26px; }

.tw-userchip { display: flex; align-items: center; gap: 10px; }
.tw-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--tw-ink);
  color: var(--tw-paper);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Newsreader', serif;
  font-weight: 600;
  font-size: 15px;
}

.tw-logout {
  border: 1px solid var(--tw-line);
  background: transparent;
  border-radius: var(--tw-radius-sm);
  padding: 7px 10px;
  cursor: pointer;
  color: var(--tw-ink-soft);
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  transition: all .16s ease;
}
.tw-logout:hover {
  border-color: var(--tw-seal);
  color: var(--tw-seal);
  background: rgba(178,58,46,0.05);
}

/* Stamp / seal component used across dashboard */
.tw-stamp {
  border: 2px solid currentColor;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 88px;
  height: 88px;
  flex-shrink: 0;
  transform: rotate(-4deg);
}
.tw-stamp .tw-stamp-num {
  font-family: 'Newsreader', serif;
  font-weight: 700;
  font-size: 26px;
  line-height: 1;
}
.tw-stamp .tw-stamp-lbl {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-top: 2px;
}

.tw-card {
  background: #FFFFFF;
  border: 1px solid var(--tw-line);
  border-radius: var(--tw-radius);
  box-shadow: var(--tw-shadow-sm);
  transition: box-shadow .18s ease, transform .18s ease;
}

.tw-kpi-row { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 22px; }
.tw-kpi {
  flex: 1;
  min-width: 150px;
  padding: 17px 19px;
  display: flex;
  align-items: center;
  gap: 14px;
}
.tw-kpi:hover {
  box-shadow: var(--tw-shadow-md);
  transform: translateY(-1px);
}
.tw-kpi-text .tw-kpi-count {
  font-family: 'Newsreader', serif;
  font-size: 30px;
  font-weight: 600;
  color: var(--tw-ink);
}
.tw-kpi-text .tw-kpi-label {
  font-size: 12px;
  color: var(--tw-ink-soft);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.tw-section-title {
  font-family: 'Newsreader', serif;
  font-size: 17px;
  font-weight: 600;
  color: var(--tw-ink);
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 4px 0 12px 0;
}

/* register / index card task item */
.tw-task-card {
  position: relative;
  background: #FFFFFF;
  border: 1px solid var(--tw-line);
  border-left: 4px solid var(--tw-steel);
  border-radius: var(--tw-radius-sm);
  padding: 13px 15px 13px 20px;
  margin-bottom: 10px;
  cursor: pointer;
  box-shadow: var(--tw-shadow-sm);
  transition: box-shadow .16s ease, transform .16s ease, border-color .16s ease;
}
.tw-task-card:hover {
  box-shadow: var(--tw-shadow-md);
  transform: translateY(-1px);
}
.tw-task-card::before {
  content: "";
  position: absolute;
  left: 6px;
  top: 50%;
  transform: translateY(-50%);
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--tw-paper);
  border: 1px solid var(--tw-line);
}

.tw-task-title {
  font-weight: 600;
  font-size: 14.5px;
  color: var(--tw-ink);
}
.tw-task-meta {
  font-size: 12px;
  color: var(--tw-ink-soft);
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 4px;
  align-items: center;
}
.tw-badge {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 10.5px;
  padding: 2.5px 8px;
  border-radius: 20px;
  letter-spacing: 0.02em;
}
.tw-tag {
  font-size: 10.5px;
  padding: 2.5px 8px;
  border-radius: 20px;
  background: rgba(59,110,143,0.1);
  color: var(--tw-steel);
  font-weight: 500;
}

.tw-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 16px;
  border-radius: var(--tw-radius-sm);
  font-weight: 600;
  font-size: 13.5px;
  cursor: pointer;
  border: 1.5px solid var(--tw-ink);
  background: var(--tw-ink);
  color: var(--tw-paper);
  transition: all .16s ease;
}
.tw-btn:hover {
  background: #24365c;
  box-shadow: var(--tw-shadow-sm);
  transform: translateY(-1px);
}
.tw-btn.tw-btn-ghost {
  background: transparent;
  color: var(--tw-ink);
  box-shadow: none;
}
.tw-btn.tw-btn-ghost:hover {
  background: rgba(27,42,74,0.06);
  transform: translateY(-1px);
}
.tw-btn.tw-btn-seal {
  border-color: var(--tw-seal);
  background: var(--tw-seal);
  color: #fff;
}
.tw-btn.tw-btn-seal:hover { background: #93281f; }
.tw-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.tw-input, .tw-select, .tw-textarea {
  width: 100%;
  border: 1px solid var(--tw-line);
  background: #fff;
  border-radius: var(--tw-radius-sm);
  padding: 9px 11px;
  font-size: 13.5px;
  font-family: 'IBM Plex Sans', sans-serif;
  color: var(--tw-ink);
  transition: border-color .16s ease, box-shadow .16s ease;
}
.tw-input:focus, .tw-select:focus, .tw-textarea:focus {
  outline: none;
  border-color: var(--tw-steel);
  box-shadow: 0 0 0 3px rgba(59,110,143,0.14);
}

.tw-label {
  font-size: 11.5px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--tw-ink-soft);
  font-weight: 600;
  display: block;
  margin-bottom: 5px;
}

.tw-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(27,26,20,0.5);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  padding: 20px;
}
.tw-modal {
  background: var(--tw-paper);
  border-radius: 14px;
  border: 1px solid var(--tw-line);
  width: 100%;
  max-width: 640px;
  max-height: 88vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0,0,0,0.28);
}
.tw-modal-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--tw-line);
  position: sticky;
  top: 0;
  background: var(--tw-paper);
  z-index: 2;
}
.tw-modal-body { padding: 18px 20px 22px; }

.tw-iconbtn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--tw-ink-soft);
  padding: 5px;
  border-radius: var(--tw-radius-sm);
  transition: all .16s ease;
}
.tw-iconbtn:hover {
  background: rgba(27,42,74,0.08);
  color: var(--tw-ink);
}

.tw-toast {
  position: fixed;
  bottom: 50px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--tw-ink);
  color: var(--tw-paper);
  padding: 10px 20px;
  border-radius: 24px;
  font-size: 13px;
  font-weight: 500;
  z-index: 100;
  box-shadow: 0 8px 24px rgba(0,0,0,0.22);
}

.tw-status-stepper { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.tw-step {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 11px;
  padding: 5px 10px;
  border-radius: 20px;
  border: 1px solid var(--tw-line);
  color: var(--tw-ink-soft);
}
.tw-step.current { color: #fff; font-weight: 600; border-color: transparent; }

.tw-login-card { max-width: 460px; margin: 60px auto; }
.tw-unit-tab {
  padding: 6px 13px;
  border-radius: 20px;
  font-size: 12.5px;
  cursor: pointer;
  border: 1px solid var(--tw-line);
  color: var(--tw-ink-soft);
  white-space: nowrap;
  transition: all .16s ease;
  user-select: none;
}
.tw-unit-tab:hover { border-color: var(--tw-steel); color: var(--tw-ink); }
.tw-unit-tab.active {
  background: var(--tw-ink);
  color: var(--tw-paper);
  border-color: var(--tw-ink);
}

.tw-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.tw-table th {
  text-align: left;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 10.5px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--tw-ink-soft);
  border-bottom: 1.5px solid var(--tw-ink);
  padding: 9px 10px;
}
.tw-table td { padding: 9px 10px; border-bottom: 1px solid var(--tw-line); }
.tw-table tr { transition: background .12s ease; }
.tw-table tr:hover td { background: rgba(199,125,34,0.06); }

/* Excel-style bottom sheet tabs, switching between Office and Personal spaces */
.tw-space-tabbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 40;
  display: flex;
  align-items: flex-end;
  gap: 2px;
  background: #E2DECE;
  border-top: 1px solid var(--tw-line);
  padding: 6px 10px 0 10px;
}
.tw-space-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--tw-ink-soft);
  background: #D2CBB4;
  border: 1px solid var(--tw-line);
  border-bottom: none;
  border-radius: 8px 8px 0 0;
  cursor: pointer;
  transition: all .16s ease;
  user-select: none;
}
.tw-space-tab:hover { background: #DCD5BF; }
.tw-space-tab.active {
  background: var(--tw-paper);
  color: var(--tw-ink);
  border-color: var(--tw-line);
  box-shadow: 0 -1px 0 var(--tw-paper);
}

.tw-mention-item {
  padding: 7px 10px;
  font-size: 13px;
  cursor: pointer;
  border-radius: var(--tw-radius-sm);
  color: var(--tw-ink);
  transition: background .12s ease;
}
.tw-mention-item:hover { background: rgba(199,125,34,0.14); }

.tw-day-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  padding: 3px 7px;
  border-radius: 20px;
  font-size: 11px;
  font-family: 'IBM Plex Mono', monospace;
  cursor: pointer;
  border: 1px solid var(--tw-line);
  color: var(--tw-ink-soft);
  background: #fff;
  transition: all .16s ease;
  user-select: none;
}
.tw-day-chip:hover { background: rgba(199,125,34,0.12); }
.tw-day-chip.active {
  background: var(--tw-ink);
  color: var(--tw-paper);
  border-color: var(--tw-ink);
}

.tw-print-table { display: none; }
@media print {
  body * { visibility: hidden; }
  .tw-print-table, .tw-print-table * { visibility: visible; }
  .tw-print-table {
    display: block;
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    padding: 20px;
    font-family: 'IBM Plex Sans', sans-serif;
  }
  .tw-print-table table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10.5px;
  }
  .tw-print-table th, .tw-print-table td {
    border: 1px solid #999;
    padding: 5px 7px;
    text-align: left;
    vertical-align: top;
  }
  .tw-print-table th {
    background: #eee;
    font-family: 'IBM Plex Mono', monospace;
    text-transform: uppercase;
    font-size: 9px;
  }
  .tw-print-table h1 {
    font-family: 'Newsreader', serif;
    font-size: 18px;
    margin: 0 0 4px 0;
  }
  .tw-print-table .tw-print-meta {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 10px;
    color: #555;
    margin-bottom: 14px;
  }
}
`;
