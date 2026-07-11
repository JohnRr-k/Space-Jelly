import type { DateKey } from "./types";

/** Local-time date key (YYYY-MM-DD). ASCENSION lives in Russ's timezone. */
export function toDateKey(d: Date): DateKey {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromDateKey(key: DateKey): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: DateKey, delta: number): DateKey {
  const d = fromDateKey(key);
  d.setDate(d.getDate() + delta);
  return toDateKey(d);
}

export function todayKey(now: Date = new Date()): DateKey {
  return toDateKey(now);
}

/** "Wednesday 9 July" — used in the Daily header. */
export function formatLongDate(key: DateKey): string {
  return fromDateKey(key).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** "Wed 9 Jul" — used in history lists. */
export function formatShortDate(key: DateKey): string {
  return fromDateKey(key).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}
