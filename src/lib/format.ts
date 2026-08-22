import type { FeedFixture } from "./types";

/** App calendar timezone (board + labels). */
export const APP_TZ = "Africa/Nairobi";

/** YYYY-MM-DD for a UTC instant in the app timezone. */
export function dayKeyOf(utcDate: string | Date): string {
  const d = typeof utcDate === "string" ? new Date(utcDate) : utcDate;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function todayKey(): string {
  return dayKeyOf(new Date());
}

export function addDaysToKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, (m ?? 1) - 1, (d ?? 1) + days));
  return dt.toISOString().slice(0, 10);
}

export function yesterdayKey(): string {
  return addDaysToKey(todayKey(), -1);
}

export function tomorrowKey(): string {
  return addDaysToKey(todayKey(), 1);
}

export function dayAfterTomorrowKey(): string {
  return addDaysToKey(todayKey(), 2);
}

function fromKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function dayLabel(key: string): string {
  if (key === yesterdayKey()) return "Yesterday";
  if (key === todayKey()) return "Today";
  if (key === tomorrowKey()) return "Tomorrow";
  if (key === dayAfterTomorrowKey()) return "Day after tomorrow";
  return fromKey(key).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function dayLabelLong(key: string): string {
  return fromKey(key).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function dayLabelShort(key: string): string {
  if (key === yesterdayKey()) return "Yesterday";
  if (key === todayKey()) return "Today";
  if (key === tomorrowKey()) return "Tomorrow";
  if (key === dayAfterTomorrowKey()) return "Day after";
  return fromKey(key).toLocaleDateString(undefined, { weekday: "short", day: "numeric" });
}

export function kickoff(utcDate: string): string {
  return new Date(utcDate).toLocaleTimeString(undefined, {
    timeZone: APP_TZ,
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fixtureDateLine(utcDate: string): string {
  const d = new Date(utcDate);
  return `${d.toLocaleDateString(undefined, {
    timeZone: APP_TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
  })} · ${kickoff(utcDate)}`;
}

export type DayGroup = { key: string; fixtures: FeedFixture[] };

export function groupByDay(fixtures: FeedFixture[]): DayGroup[] {
  const map = new Map<string, FeedFixture[]>();
  for (const f of fixtures) {
    const key = dayKeyOf(f.utcDate);
    const bucket = map.get(key);
    if (bucket) bucket.push(f);
    else map.set(key, [f]);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, list]) => ({
      key,
      fixtures: list.sort((a, b) => a.utcDate.localeCompare(b.utcDate)),
    }));
}

/** Ordered board tabs: yesterday → day after tomorrow (only keys that exist optional). */
export function boardDayKeys(): string[] {
  const t = todayKey();
  return [addDaysToKey(t, -1), t, addDaysToKey(t, 1), addDaysToKey(t, 2)];
}
