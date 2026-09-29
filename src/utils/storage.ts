// Storage helpers supporting both window.storage (if provided in host sandbox)
// and standard browser localStorage as durable fallback.

interface StorageResult {
  value: string | null;
}

interface WindowStorage {
  get: (key: string, shared: boolean) => Promise<StorageResult | null>;
  set: (key: string, value: string, shared: boolean) => Promise<void>;
}

declare global {
  interface Window {
    storage?: WindowStorage;
  }
}

export async function loadShared<T>(key: string, fallback: T): Promise<T> {
  try {
    if (typeof window !== 'undefined' && window.storage?.get) {
      const res = await window.storage.get(key, true);
      if (res && res.value != null) return JSON.parse(res.value);
    } else if (typeof localStorage !== 'undefined') {
      const item = localStorage.getItem('shared_' + key);
      if (item != null) return JSON.parse(item);
    }
    return fallback;
  } catch (e) {
    console.warn('loadShared error:', e);
    return fallback;
  }
}

export async function saveShared<T>(key: string, value: T): Promise<void> {
  try {
    const str = JSON.stringify(value);
    if (typeof window !== 'undefined' && window.storage?.set) {
      await window.storage.set(key, str, true);
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('shared_' + key, str);
    }
  } catch (e) {
    console.warn('saveShared error:', e);
  }
}

export async function loadPersonal<T>(key: string): Promise<T | null> {
  try {
    if (typeof window !== 'undefined' && window.storage?.get) {
      const res = await window.storage.get(key, false);
      if (res && res.value != null) return JSON.parse(res.value);
    } else if (typeof localStorage !== 'undefined') {
      const item = localStorage.getItem('personal_' + key);
      if (item != null) return JSON.parse(item);
    }
    return null;
  } catch (e) {
    console.warn('loadPersonal error:', e);
    return null;
  }
}

export async function savePersonal<T>(key: string, value: T): Promise<void> {
  try {
    const str = JSON.stringify(value);
    if (typeof window !== 'undefined' && window.storage?.set) {
      await window.storage.set(key, str, false);
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('personal_' + key, str);
    }
  } catch (e) {
    console.warn('savePersonal error:', e);
  }
}

export async function load<T>(key: string): Promise<T | null> {
  return loadShared<T | null>(key, null);
}

export async function save<T>(key: string, value: T): Promise<void> {
  return saveShared<T>(key, value);
}
