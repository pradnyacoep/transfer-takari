export interface Membership {
  unit: string;
  role: 'section_head' | 'member';
}

export interface OfficeContact {
  phone?: string;
  contactPerson?: string;
  email?: string;
  notes?: string;
}

export interface User {
  id: string;
  name: string;
  role: 'admin' | 'section_head' | 'member';
  unit: string | null;
  designation?: string;
  phone?: string;
  active?: boolean;
  memberships?: Membership[];
}

export interface CommentAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
  dataUrl?: string;
}

export interface Comment {
  id: string;
  userId?: string;
  text: string;
  at: string;
  editedAt?: string;
  attachments?: CommentAttachment[];
}

export interface TaskHistoryItem {
  status: string;
  at: string;
  by: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  units?: string[];
  unit?: string;
  assigneeIds?: string[];
  assigneeId?: string;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent' | string;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'UNDER_REVIEW' | 'COMPLETED' | 'ARCHIVED' | string;
  deadline?: string | null;
  nextFollowUpDate?: string | null;
  lastFollowUp?: string | null;
  pendingAt?: string[];
  pendingAtOffice?: string;
  pendingSince?: string | null;
  tags?: string[];
  scheme?: string;
  package?: string;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
  comments: Comment[];
  attachments?: string[];
  history: TaskHistoryItem[];
}

export interface PersonalTask {
  id: string;
  title: string;
  description?: string;
  assignedTo?: string;
  createdBy?: string;
  priority?: 'Low' | 'Medium' | 'High' | 'Urgent' | string;
  status: 'TODO' | 'IN_PROGRESS' | 'DONE' | 'ARCHIVED' | string;
  dueDate?: string | null;
  nextFollowUpDate?: string | null;
  lastFollowUp?: string | null;
  tags?: string[];
  createdAt: string;
  comments: Comment[];
}
