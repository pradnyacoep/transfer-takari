import { Task, Comment, TaskHistoryItem } from '../types';

/**
 * Extracts the latest modification timestamp from a task based on its properties,
 * comments, and status history.
 */
export function getTaskLatestTimestamp(task: Task): number {
  let latest = 0;

  if (task.updatedAt) {
    const t = new Date(task.updatedAt).getTime();
    if (!isNaN(t) && t > latest) latest = t;
  }

  if (task.lastFollowUp) {
    const t = new Date(task.lastFollowUp).getTime();
    if (!isNaN(t) && t > latest) latest = t;
  }

  if (task.createdAt) {
    const t = new Date(task.createdAt).getTime();
    if (!isNaN(t) && t > latest) latest = t;
  }

  if (task.comments && task.comments.length > 0) {
    for (const c of task.comments) {
      if (c.editedAt) {
        const t = new Date(c.editedAt).getTime();
        if (!isNaN(t) && t > latest) latest = t;
      }
      if (c.at) {
        const t = new Date(c.at).getTime();
        if (!isNaN(t) && t > latest) latest = t;
      }
    }
  }

  if (task.history && task.history.length > 0) {
    for (const h of task.history) {
      if (h.at) {
        const t = new Date(h.at).getTime();
        if (!isNaN(t) && t > latest) latest = t;
      }
    }
  }

  return latest;
}

/**
 * Combines comments from two task versions, preserving all unique comments
 * and deduplicating by ID or text+timestamp.
 */
export function mergeComments(local?: Comment[], cloud?: Comment[]): Comment[] {
  const merged: Comment[] = [];
  const seenIds = new Set<string>();

  const all = [...(cloud || []), ...(local || [])];
  for (const c of all) {
    const key = c.id || `${c.at}_${c.text}`;
    if (!seenIds.has(key)) {
      seenIds.add(key);
      merged.push(c);
    }
  }

  // Sort comments chronologically ascending
  return merged.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

/**
 * Combines status transition history items, deduplicating by status + timestamp.
 */
export function mergeHistory(local?: TaskHistoryItem[], cloud?: TaskHistoryItem[]): TaskHistoryItem[] {
  const merged: TaskHistoryItem[] = [];
  const seen = new Set<string>();

  const all = [...(cloud || []), ...(local || [])];
  for (const h of all) {
    const key = `${h.status}_${h.at}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(h);
    }
  }

  return merged.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

export interface ReconciliationResult {
  reconciled: Task[];
  pendingLocalToUpload: Task[];
  hasChanges: boolean;
}

/**
 * Reconciles local and cloud tasks using Last-Write-Wins (LWW) with content preservation.
 * Prevents cloud snapshots from overwriting unsaved local device edits, while uploading
 * any newer local edits to cloud.
 */
export function reconcileTasks(localTasks: Task[], cloudTasks: Task[]): ReconciliationResult {
  const cloudMap = new Map<string, Task>();
  for (const ct of cloudTasks) {
    cloudMap.set(ct.id.toLowerCase(), ct);
  }

  const localMap = new Map<string, Task>();
  for (const lt of localTasks) {
    localMap.set(lt.id.toLowerCase(), lt);
  }

  const reconciledMap = new Map<string, Task>();
  const pendingLocalToUpload: Task[] = [];
  let hasChanges = false;

  // 1. Process tasks present in local storage
  for (const [idKey, localTask] of localMap.entries()) {
    const cloudTask = cloudMap.get(idKey);

    if (!cloudTask) {
      // Task exists locally but not in cloud -> keep and mark for upload
      reconciledMap.set(idKey, localTask);
      pendingLocalToUpload.push(localTask);
      hasChanges = true;
      continue;
    }

    const localTime = getTaskLatestTimestamp(localTask);
    const cloudTime = getTaskLatestTimestamp(cloudTask);
    const mergedCommentsList = mergeComments(localTask.comments, cloudTask.comments);
    const mergedHistoryList = mergeHistory(localTask.history, cloudTask.history);

    if (localTime > cloudTime) {
      // Local is newer -> use local values, merge comments/history, upload to cloud
      const updatedLocal: Task = {
        ...localTask,
        comments: mergedCommentsList,
        history: mergedHistoryList,
        updatedAt: localTask.updatedAt || new Date().toISOString(),
      };
      reconciledMap.set(idKey, updatedLocal);
      pendingLocalToUpload.push(updatedLocal);
      hasChanges = true;
    } else {
      // Cloud is newer or equal -> use cloud values, merge any extra local comments
      const updatedFromCloud: Task = {
        ...cloudTask,
        comments: mergedCommentsList,
        history: mergedHistoryList,
      };
      reconciledMap.set(idKey, updatedFromCloud);
      if (cloudTime > localTime) {
        hasChanges = true;
      }
    }
  }

  // 2. Add tasks that exist in cloud but not locally
  for (const [idKey, cloudTask] of cloudMap.entries()) {
    if (!reconciledMap.has(idKey)) {
      reconciledMap.set(idKey, cloudTask);
      hasChanges = true;
    }
  }

  const reconciled = Array.from(reconciledMap.values());
  return {
    reconciled,
    pendingLocalToUpload,
    hasChanges,
  };
}
