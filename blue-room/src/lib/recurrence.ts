import type { CalendarEvent, Recurrence } from '../data/types';
import { addDays, addMonths, daysInMonth, diffDays, makeDate, parseDate, startOfWeek, weekday } from './dates';

export interface Occurrence {
  key: string; // `${eventId}:${startDate}`
  event: CalendarEvent;
  date: string; // start date of this occurrence
  endDate: string; // end date (same length as the original event)
  completed: boolean;
}

export const noRecurrence = (): Recurrence => ({ freq: 'none', interval: 1 });

const MAX_ITER = 20000;

/** All start dates of an event's series that begin on or before `rangeEnd` (lazy, in order). */
function* seriesDates(ev: CalendarEvent, rangeEnd: string): Generator<string> {
  const r = ev.recurrence;
  const start = ev.date;
  if (!r || r.freq === 'none') { yield start; return; }
  const interval = Math.max(1, Math.floor(r.interval || 1));
  const limit = r.until && r.until < rangeEnd ? r.until : rangeEnd;
  let emitted = 0;
  const maxCount = r.count && r.count > 0 ? r.count : Infinity;
  let iter = 0;

  if (r.freq === 'daily') {
    for (let d = start; d <= limit && iter++ < MAX_ITER; d = addDays(d, interval)) {
      if (emitted++ >= maxCount) return;
      yield d;
    }
  } else if (r.freq === 'weekly') {
    const days = (r.byWeekday && r.byWeekday.length ? [...new Set(r.byWeekday)] : [weekday(start)]).sort((a, b) => a - b);
    // Anchor weeks on Monday so `interval` weeks is stable regardless of display preference.
    const anchor = startOfWeek(start, 1);
    for (let w = anchor; w <= limit && iter++ < MAX_ITER; w = addDays(w, 7 * interval)) {
      for (const wd of days) {
        const d = addDays(w, (wd - 1 + 7) % 7); // offset from Monday
        if (d < start) continue;
        if (d > limit) return;
        if (emitted++ >= maxCount) return;
        yield d;
      }
    }
  } else if (r.freq === 'monthly') {
    const { d: dom } = parseDate(start);
    for (let i = 0; iter++ < MAX_ITER; i += interval) {
      const base = addMonths(`${start.slice(0, 7)}-01`, i);
      const { y, m } = parseDate(base);
      const d = makeDate(y, m, Math.min(dom, daysInMonth(y, m))); // 31st → last day of shorter months
      if (d > limit) return;
      if (emitted++ >= maxCount) return;
      yield d;
    }
  } else if (r.freq === 'yearly') {
    const { y: y0, m, d: dd } = parseDate(start);
    for (let i = 0; iter++ < MAX_ITER; i += interval) {
      const y = y0 + i;
      const d = makeDate(y, m, Math.min(dd, daysInMonth(y, m))); // Feb 29 → Feb 28 in common years
      if (d > limit) return;
      if (emitted++ >= maxCount) return;
      yield d;
    }
  }
}

/** Expand an event into the occurrences that overlap [rangeStart, rangeEnd] (inclusive). */
export function expandEvent(ev: CalendarEvent, rangeStart: string, rangeEnd: string): Occurrence[] {
  const span = Math.max(0, diffDays(ev.endDate || ev.date, ev.date));
  const out: Occurrence[] = [];
  const excluded = new Set(ev.excludedDates ?? []);
  const done = new Set(ev.completedDates ?? []);
  const recurring = ev.recurrence && ev.recurrence.freq !== 'none';
  for (const d of seriesDates(ev, rangeEnd)) {
    const end = addDays(d, span);
    if (end < rangeStart) continue;
    if (d > rangeEnd) break;
    if (excluded.has(d)) continue;
    out.push({ key: `${ev.id}:${d}`, event: ev, date: d, endDate: end, completed: recurring ? done.has(d) : ev.completed });
  }
  return out;
}

export function expandMany(events: CalendarEvent[], rangeStart: string, rangeEnd: string): Occurrence[] {
  const all: Occurrence[] = [];
  for (const ev of events) all.push(...expandEvent(ev, rangeStart, rangeEnd));
  return all.sort(compareOccurrences);
}

export function compareOccurrences(a: Occurrence, b: Occurrence): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.event.allDay !== b.event.allDay) return a.event.allDay ? -1 : 1;
  return (a.event.startTime || '').localeCompare(b.event.startTime || '') || a.event.title.localeCompare(b.event.title);
}

export function occurrencesOnDay(occs: Occurrence[], day: string): Occurrence[] {
  return occs.filter((o) => o.date <= day && o.endDate >= day);
}

export function describeRecurrence(r: Recurrence): string {
  if (!r || r.freq === 'none') return 'Does not repeat';
  const n = r.interval > 1 ? `every ${r.interval} ` : 'every ';
  const unit = { daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' }[r.freq];
  let s = r.interval > 1 ? `Repeats ${n}${unit}s` : `Repeats ${r.freq}`;
  if (r.freq === 'weekly' && r.byWeekday?.length) {
    const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    s += ` on ${r.byWeekday.map((d) => names[d]).join(', ')}`;
  }
  if (r.until) s += `, until ${r.until}`;
  if (r.count) s += `, ${r.count} times`;
  return s;
}
