import { Task } from '../types';

/**
 * User-created packages palette
 */
const PACKAGE_COLOR_PALETTE = [
  '#1E40AF', // Deep Blue
  '#065F46', // Emerald
  '#9D174D', // Pinkish Wine
  '#7C2D12', // Warm Russet
  '#92400E', // Amber
  '#4338CA', // Indigo
  '#0E7490', // Cyan Teal
  '#6D28D9', // Purple
  '#374151', // Dark Slate
  '#047857', // Forest
];

/**
 * Deterministically generates a distinctive badge color for any user-created package
 */
export function getPackageBadgeColor(packageName: string): string {
  if (!packageName) return '#475569';
  let hash = 0;
  for (let i = 0; i < packageName.length; i++) {
    hash = packageName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % PACKAGE_COLOR_PALETTE.length;
  return PACKAGE_COLOR_PALETTE[index];
}

/**
 * Returns the package explicitly assigned to this task, or null if none was assigned.
 * (No automatic guessing or keyword-based assignment).
 */
export function getTaskPackage(task: Task): string | null {
  const pkg = task.package || task.scheme;
  if (pkg && pkg.trim().length > 0) {
    return pkg.trim();
  }
  return null;
}

/**
 * Check if a task matches a selected package filter
 */
export function matchesPackageFilter(task: Task, filterPackage: string | null): boolean {
  if (!filterPackage || filterPackage === 'ALL') return true;
  const assigned = getTaskPackage(task);
  if (filterPackage === 'UNASSIGNED') {
    return !assigned;
  }
  return assigned?.toLowerCase() === filterPackage.toLowerCase();
}

// Backward compatibility export if needed
export const SCHEME_PACKAGES: any[] = [];
export function detectTaskScheme(task: Task): string {
  return getTaskPackage(task) || '';
}
export function getSchemeDefinition(schemeId: string): { id: string; label: string; shortLabel: string; badgeColor: string } | null {
  if (!schemeId) return null;
  return {
    id: schemeId,
    label: schemeId,
    shortLabel: schemeId,
    badgeColor: getPackageBadgeColor(schemeId),
  };
}
export function matchesSchemeFilter(task: Task, filterSchemeId: string | null): boolean {
  return matchesPackageFilter(task, filterSchemeId);
}
