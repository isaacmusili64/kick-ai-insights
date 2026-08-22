/** Lightweight persistent cache for React Query results (localStorage). */

const PREFIX = "pm-cache:v1:";

type Entry<T> = { savedAt: number; data: T };

function key(parts: (string | number)[]) {
  return PREFIX + parts.join(":");
}

export function readCache<T>(parts: (string | number)[], maxAgeMs: number): { data: T; savedAt: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key(parts));
    if (!raw) return null;
    const entry = JSON.parse(raw) as Entry<T>;
    if (!entry || typeof entry.savedAt !== "number") return null;
    if (Date.now() - entry.savedAt > maxAgeMs) return null;
    return { data: entry.data, savedAt: entry.savedAt };
  } catch {
    return null;
  }
}

export function writeCache<T>(parts: (string | number)[], data: T): void {
  if (typeof window === "undefined") return;
  try {
    const entry: Entry<T> = { savedAt: Date.now(), data };
    localStorage.setItem(key(parts), JSON.stringify(entry));
  } catch {
    // Quota / private mode — ignore
  }
}

export function clearCachePrefix(): void {
  if (typeof window === "undefined") return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX)) keys.push(k);
    }
    for (const k of keys) localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}
