import { User, Task, PersonalTask } from '../types';
import { REAL_UPLOADED_TASKS } from './realTasks';

export const DEFAULT_ADMIN_USER: User = {
  id: 'usr_ee_admin',
  name: 'Executive Engineer',
  role: 'admin',
  unit: null,
  designation: 'Executive Engineer',
  phone: '',
  active: true,
  memberships: [],
};

export const SEED_USERS: User[] = [DEFAULT_ADMIN_USER];

export function getInitialTasks(): Task[] {
  return REAL_UPLOADED_TASKS;
}

export function getInitialUsers(): User[] {
  return [DEFAULT_ADMIN_USER];
}

export function getInitialPersonalTasks(): PersonalTask[] {
  return [];
}
