import type { FeedFixture } from "./types";

export function dayKeyOf(utcDate: string): string {
  const d = new Date(utcDate);
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayKey(): string {
  return dayKeyOf(new Date().toISOString());
}

export function tomorrowKey(): string {
  return dayKeyOf(new Date(Date.now() + 86_400_000).toISOString());
}

function fromKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function dayLabel(key: string): string {
  if (key === todayKey()) return "Today";
  if (key === tomorrowKey()) return "Tomorrow";
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
  if (key === todayKey()) return "Today";
  if (key === tomorrowKey()) return "Tomorrow";
  return fromKey(key).toLocaleDateString(undefined, { weekday: "short", day: "numeric" });
}

export function kickoff(utcDate: string): string {
  return new Date(utcDate).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fixtureDateLine(utcDate: string): string {
  const d = new Date(utcDate);
  return `${d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })} · ${kickoff(utcDate)}`;
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