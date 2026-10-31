/** Date/time helpers. Calendar dates are `YYYY-MM-DD` strings (no implicit timezone);
 *  instants are converted explicitly with an IANA time zone so DST is handled correctly. */

export const pad = (n: number, w = 2) => String(n).padStart(w, '0');

export function isValidDate(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1) return false;
  return d <= daysInMonth(y, m);
}

export function isValidTime(s: unknown): s is string {
  return typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function parseDate(s: string): { y: number; m: number; d: number } {
  const [y, m, d] = s.split('-').map(Number);
  return { y, m, d };
}

export function makeDate(y: number, m: number, d: number): string {
  return `${pad(y, 4)}-${pad(m)}-${pad(d)}`;
}

/** Day number (days since 1970-01-01) — makes date arithmetic trivial and DST-proof. */
export function toDayNumber(s: string): number {
  const { y, m, d } = parseDate(s);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}

export function fromDayNumber(n: number): string {
  const dt = new Date(n * 86400000);
  return makeDate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export const addDays = (s: string, n: number) => fromDayNumber(toDayNumber(s) + n);
export const diffDays = (a: string, b: string) => toDayNumber(a) - toDayNumber(b);

/** 0 = Sunday … 6 = Saturday */
export function weekday(s: string): number {
  return (((toDayNumber(s) + 4) % 7) + 7) % 7;
}

export function addMonths(s: string, n: number): string {
  const { y, m, d } = parseDate(s);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return makeDate(ny, nm, Math.min(d, daysInMonth(ny, nm)));
}

export const startOfMonth = (s: string) => `${s.slice(0, 7)}-01`;
export const endOfMonth = (s: string) => {
  const { y, m } = parseDate(s);
  return makeDate(y, m, daysInMonth(y, m));
};

export function startOfWeek(s: string, weekStart: 0 | 1): string {
  const diff = (weekday(s) - weekStart + 7) % 7;
  return addDays(s, -diff);
}

export function monthGrid(monthDate: string, weekStart: 0 | 1): string[] {
  const first = startOfMonth(monthDate);
  const gridStart = startOfWeek(first, weekStart);
  const last = endOfMonth(monthDate);
  const weeks = Math.ceil((diffDays(last, gridStart) + 1) / 7);
  return Array.from({ length: weeks * 7 }, (_, i) => addDays(gridStart, i));
}

export function weekDays(s: string, weekStart: 0 | 1): string[] {
  const st = startOfWeek(s, weekStart);
  return Array.from({ length: 7 }, (_, i) => addDays(st, i));
}

// ---------- time zones ----------

export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function listTimeZones(): string[] {
  const fn = (Intl as any).supportedValuesOf;
  if (typeof fn === 'function') {
    try {
      const list: string[] = fn('timeZone');
      return list.includes('UTC') ? list : ['UTC', ...list];
    } catch { /* fall through */ }
  }
  return ['UTC', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Asia/Manila', 'Asia/Tokyo', 'Australia/Sydney'];
}

const dtfCache = new Map<string, Intl.DateTimeFormat>();
function dtf(tz: string): Intl.DateTimeFormat {
  let f = dtfCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    dtfCache.set(tz, f);
  }
  return f;
}

export interface WallClock { date: string; time: string; y: number; m: number; d: number; hh: number; mm: number; ss: number }

/** The wall-clock reading for an instant in the given zone. */
export function wallClock(ts: number, tz: string): WallClock {
  const parts: Record<string, number> = {};
  for (const p of dtf(tz).formatToParts(new Date(ts))) {
    if (p.type !== 'literal') parts[p.type] = parseInt(p.value, 10);
  }
  const hh = parts.hour === 24 ? 0 : parts.hour;
  return {
    y: parts.year, m: parts.month, d: parts.day, hh, mm: parts.minute, ss: parts.second,
    date: makeDate(parts.year, parts.month, parts.day), time: `${pad(hh)}:${pad(parts.minute)}`,
  };
}

function offsetAt(ts: number, tz: string): number {
  const w = wallClock(ts, tz);
  const asUtc = Date.UTC(w.y, w.m - 1, w.d, w.hh, w.mm, w.ss);
  return asUtc - Math.floor(ts / 1000) * 1000;
}

/** Convert a wall-clock date+time in `tz` to an instant. Handles DST gaps/overlaps. */
export function zonedToInstant(date: string, time: string, tz: string): number {
  const { y, m, d } = parseDate(date);
  const [hh, mm] = time.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm, 0);
  const o1 = offsetAt(guess, tz);
  const t1 = guess - o1;
  const o2 = offsetAt(t1, tz);
  return o1 === o2 ? t1 : guess - o2;
}

export const todayIn = (tz: string, now = Date.now()) => wallClock(now, tz).date;

// ---------- formatting ----------

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const monthName = (m: number) => MONTHS[m - 1];
export const weekdayName = (w: number, short = false) => (short ? WEEKDAYS[w].slice(0, 3) : WEEKDAYS[w]);
export const weekdayLetter = (w: number) => WEEKDAYS[w].slice(0, 1);

export type DateFormat = 'MDY' | 'DMY' | 'ISO';

export function formatDate(s: string | undefined, fmt: DateFormat = 'MDY', opts: { weekday?: boolean; short?: boolean; year?: boolean } = {}): string {
  if (!s || !isValidDate(s)) return '';
  const { y, m, d } = parseDate(s);
  if (fmt === 'ISO' && !opts.weekday) return opts.year === false ? `${pad(m)}-${pad(d)}` : s;
  const mon = opts.short ? MONTHS[m - 1].slice(0, 3) : MONTHS[m - 1];
  const wd = opts.weekday ? `${weekdayName(weekday(s), opts.short)}, ` : '';
  const yr = opts.year === false ? '' : fmt === 'DMY' ? ` ${y}` : `, ${y}`;
  return fmt === 'DMY' || fmt === 'ISO' ? `${wd}${d} ${mon}${yr}` : `${wd}${mon} ${d}${yr}`;
}

export function formatMonthYear(s: string): string {
  const { y, m } = parseDate(s);
  return `${MONTHS[m - 1]} ${y}`;
}

export function formatTime(t: string | undefined, fmt: '12h' | '24h' = '12h'): string {
  if (!t || !isValidTime(t)) return '';
  if (fmt === '24h') return t;
  const [h, m] = t.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${pad(m)} ${suffix}`;
}

export function formatInstant(ts: number, tz: string, tf: '12h' | '24h', df: DateFormat, today?: string): string {
  const w = wallClock(ts, tz);
  const t = formatTime(w.time, tf);
  const td = today ?? todayIn(tz);
  if (w.date === td) return `Today, ${t}`;
  if (w.date === addDays(td, 1)) return `Tomorrow, ${t}`;
  if (w.date === addDays(td, -1)) return `Yesterday, ${t}`;
  return `${formatDate(w.date, df, { short: true })}, ${t}`;
}

export function relativeDays(date: string, today: string): string {
  const n = diffDays(date, today);
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n === -1) return 'yesterday';
  if (n > 1 && n < 14) return `in ${n} days`;
  if (n < -1 && n > -14) return `${-n} days ago`;
  if (n >= 14 && n < 60) return `in ${Math.round(n / 7)} weeks`;
  if (n <= -14 && n > -60) return `${Math.round(-n / 7)} weeks ago`;
  if (n >= 60) return `in ${Math.round(n / 30)} months`;
  return `${Math.round(-n / 30)} months ago`;
}

export function greetingFor(hour: number): string {
  if (hour < 5) return 'Still up';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function minutesLabel(min: number): string {
  if (min === 0) return 'At the time of the event';
  if (min < 60) return `${min} minutes before`;
  if (min < 1440) return `${min / 60} hour${min === 60 ? '' : 's'} before`;
  const d = min / 1440;
  return d === 1 ? '1 day before' : d === 7 ? '1 week before' : `${d} days before`;
}
