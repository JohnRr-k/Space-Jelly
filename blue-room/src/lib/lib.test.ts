import { describe, expect, it } from 'vitest';
import {
  addDays, addMonths, diffDays, formatDate, formatTime, isValidDate, isValidTime, monthGrid, startOfWeek, todayIn, weekday,
  wallClock, zonedToInstant,
} from './dates';
import { expandEvent } from './recurrence';
import { computeReminderInstances, evaluateReminders, MISSED_GRACE_MS } from './reminders';
import { defaultSettings } from '../data/db';
import type { CalendarEvent, ReminderState } from '../data/types';

const ev = (p: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: 'e1', createdAt: 0, updatedAt: 0, title: 'Test', date: '2026-03-02', endDate: '2026-03-02', allDay: false,
  startTime: '10:00', endTime: '11:00', description: '', location: '', url: '', category: 'Personal', reminders: [],
  recurrence: { freq: 'none', interval: 1 }, completed: false, completedDates: [], excludedDates: [], important: false,
  timezone: 'UTC', ...p,
});

describe('dates', () => {
  it('validates calendar dates strictly', () => {
    expect(isValidDate('2024-02-29')).toBe(true);
    expect(isValidDate('2025-02-29')).toBe(false);
    expect(isValidDate('2025-13-01')).toBe(false);
    expect(isValidDate('2025-1-1')).toBe(false);
    expect(isValidTime('23:59')).toBe(true);
    expect(isValidTime('24:00')).toBe(false);
  });
  it('does day math without DST drift', () => {
    expect(addDays('2026-03-07', 1)).toBe('2026-03-08');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(diffDays('2026-11-02', '2026-10-31')).toBe(2);
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(weekday('2026-10-31')).toBe(6); // Saturday
  });
  it('builds month grids that start on the preferred weekday', () => {
    const g = monthGrid('2026-10-15', 1);
    expect(weekday(g[0])).toBe(1);
    expect(g.length % 7).toBe(0);
    expect(g).toContain('2026-10-31');
    expect(startOfWeek('2026-10-31', 0)).toBe('2026-10-25');
  });
  it('converts zoned wall time to instants across DST', () => {
    // New York: UTC-5 in winter, UTC-4 in summer.
    expect(new Date(zonedToInstant('2026-01-15', '09:00', 'America/New_York')).toISOString()).toBe('2026-01-15T14:00:00.000Z');
    expect(new Date(zonedToInstant('2026-07-15', '09:00', 'America/New_York')).toISOString()).toBe('2026-07-15T13:00:00.000Z');
    // Day after spring-forward (2026-03-08) the same 09:00 wall time is an hour earlier in UTC.
    expect(new Date(zonedToInstant('2026-03-07', '09:00', 'America/New_York')).toISOString()).toBe('2026-03-07T14:00:00.000Z');
    expect(new Date(zonedToInstant('2026-03-09', '09:00', 'America/New_York')).toISOString()).toBe('2026-03-09T13:00:00.000Z');
    // Asia/Manila has no DST: UTC+8.
    expect(new Date(zonedToInstant('2026-06-01', '08:00', 'Asia/Manila')).toISOString()).toBe('2026-06-01T00:00:00.000Z');
  });
  it('reads wall clock for an instant', () => {
    const w = wallClock(Date.UTC(2026, 5, 1, 0, 30), 'Asia/Manila');
    expect(w.date).toBe('2026-06-01');
    expect(w.time).toBe('08:30');
    expect(todayIn('Pacific/Auckland', Date.UTC(2026, 0, 1, 12, 0))).toBe('2026-01-02');
  });
  it('formats dates and times by preference', () => {
    expect(formatDate('2026-03-02', 'MDY')).toBe('March 2, 2026');
    expect(formatDate('2026-03-02', 'DMY')).toBe('2 March 2026');
    expect(formatDate('2026-03-02', 'ISO')).toBe('2026-03-02');
    expect(formatTime('00:05', '12h')).toBe('12:05 AM');
    expect(formatTime('13:30', '12h')).toBe('1:30 PM');
    expect(formatTime('13:30', '24h')).toBe('13:30');
  });
});

describe('recurrence', () => {
  it('returns a single occurrence for non-recurring events', () => {
    expect(expandEvent(ev(), '2026-03-01', '2026-03-31').map((o) => o.date)).toEqual(['2026-03-02']);
    expect(expandEvent(ev(), '2026-04-01', '2026-04-30')).toHaveLength(0);
  });
  it('expands daily with interval and until', () => {
    const e = ev({ recurrence: { freq: 'daily', interval: 2, until: '2026-03-08' } });
    expect(expandEvent(e, '2026-03-01', '2026-03-31').map((o) => o.date)).toEqual(['2026-03-02', '2026-03-04', '2026-03-06', '2026-03-08']);
  });
  it('expands weekly on chosen weekdays and respects count', () => {
    const e = ev({ date: '2026-03-02', endDate: '2026-03-02', recurrence: { freq: 'weekly', interval: 1, byWeekday: [1, 3, 5], count: 5 } });
    expect(expandEvent(e, '2026-03-01', '2026-04-30').map((o) => o.date)).toEqual(['2026-03-02', '2026-03-04', '2026-03-06', '2026-03-09', '2026-03-11']);
  });
  it('supports every-other-week', () => {
    const e = ev({ recurrence: { freq: 'weekly', interval: 2 } });
    expect(expandEvent(e, '2026-03-01', '2026-04-10').map((o) => o.date)).toEqual(['2026-03-02', '2026-03-16', '2026-03-30']);
  });
  it('clamps monthly and yearly dates that do not exist', () => {
    const m = ev({ date: '2026-01-31', endDate: '2026-01-31', recurrence: { freq: 'monthly', interval: 1 } });
    expect(expandEvent(m, '2026-01-01', '2026-04-30').map((o) => o.date)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
    const y = ev({ date: '2024-02-29', endDate: '2024-02-29', recurrence: { freq: 'yearly', interval: 1 } });
    expect(expandEvent(y, '2025-01-01', '2028-12-31').map((o) => o.date)).toEqual(['2025-02-28', '2026-02-28', '2027-02-28', '2028-02-29']);
  });
  it('skips excluded dates and tracks per-occurrence completion', () => {
    const e = ev({ recurrence: { freq: 'daily', interval: 1, count: 4 }, excludedDates: ['2026-03-03'], completedDates: ['2026-03-04'] });
    const occ = expandEvent(e, '2026-03-01', '2026-03-31');
    expect(occ.map((o) => o.date)).toEqual(['2026-03-02', '2026-03-04', '2026-03-05']);
    expect(occ.find((o) => o.date === '2026-03-04')!.completed).toBe(true);
    expect(occ.find((o) => o.date === '2026-03-05')!.completed).toBe(false);
  });
  it('includes multi-day events that started before the range', () => {
    const e = ev({ date: '2026-02-27', endDate: '2026-03-03', allDay: true });
    expect(expandEvent(e, '2026-03-01', '2026-03-31')).toHaveLength(1);
  });
});

describe('reminders', () => {
  const settings = { ...defaultSettings(), timezone: 'UTC' };
  const base = { goals: [], letters: [], customReminders: [], journalDates: new Set<string>(), settings };
  const eventAt = Date.UTC(2026, 2, 2, 10, 0);

  it('computes an event reminder at the right instant', () => {
    const inst = computeReminderInstances({ ...base, events: [ev({ reminders: [30] })], now: eventAt - 3600000 });
    expect(inst).toHaveLength(1);
    expect(inst[0].dueAt).toBe(eventAt - 30 * 60000);
  });
  it('anchors all-day reminders at 09:00', () => {
    const inst = computeReminderInstances({ ...base, events: [ev({ allDay: true, startTime: '', reminders: [0, 1440] })], now: eventAt });
    expect(inst.map((i) => i.dueAt).sort()).toEqual([Date.UTC(2026, 2, 1, 9, 0), Date.UTC(2026, 2, 2, 9, 0)]);
  });
  it('does not remind about completed occurrences', () => {
    const inst = computeReminderInstances({ ...base, events: [ev({ reminders: [0], completed: true })], now: eventAt });
    expect(inst).toHaveLength(0);
  });
  it('marks a reminder seen on time as not missed, and late ones as missed — never both', () => {
    const e = [ev({ reminders: [0] })];
    const onTime = evaluateReminders(computeReminderInstances({ ...base, events: e, now: eventAt + 30000 }), new Map(), eventAt + 30000);
    expect(onTime.due).toHaveLength(1);
    expect(onTime.due[0].missed).toBe(false);
    expect(onTime.due[0].fresh).toBe(true);
    expect(onTime.toMark).toHaveLength(1);

    const late = eventAt + MISSED_GRACE_MS + 60000;
    const missed = evaluateReminders(computeReminderInstances({ ...base, events: e, now: late }), new Map(), late);
    expect(missed.due[0].missed).toBe(true);
  });
  it('does not re-fire once state exists, honours dismissal and snooze', () => {
    const e = [ev({ reminders: [0] })];
    const now = eventAt + 60000;
    const inst = computeReminderInstances({ ...base, events: e, now });
    const key = inst[0].key;
    const fired = new Map<string, ReminderState>([[key, { key, status: 'fired', seenAt: eventAt, missed: false, browserNotified: true }]]);
    const again = evaluateReminders(inst, fired, now);
    expect(again.toMark).toHaveLength(0);
    expect(again.due[0].fresh).toBe(false);

    const dismissed = new Map<string, ReminderState>([[key, { key, status: 'dismissed', seenAt: eventAt, missed: false, browserNotified: true }]]);
    expect(evaluateReminders(inst, dismissed, now).due).toHaveLength(0);

    const snoozed = new Map<string, ReminderState>([[key, { key, status: 'snoozed', seenAt: eventAt, missed: false, browserNotified: true, snoozeUntil: now + 600000 }]]);
    const s1 = evaluateReminders(inst, snoozed, now);
    expect(s1.due).toHaveLength(0);
    expect(s1.upcoming).toHaveLength(1);
    const s2 = evaluateReminders(inst, snoozed, now + 600001);
    expect(s2.due).toHaveLength(1);
    expect(s2.due[0].fresh).toBe(true);
  });
  it('lists reminders due within 36h as upcoming and drops very old ones', () => {
    const e = [ev({ reminders: [0] })];
    const up = evaluateReminders(computeReminderInstances({ ...base, events: e, now: eventAt - 3600000 }), new Map(), eventAt - 3600000);
    expect(up.upcoming).toHaveLength(1);
    expect(up.due).toHaveLength(0);
    const oldNow = eventAt + 4 * 24 * 3600000;
    const old = evaluateReminders(computeReminderInstances({ ...base, events: e, now: oldNow }), new Map(), oldNow);
    expect(old.due).toHaveLength(0);
  });
  it('builds goal-milestone and letter reminders and a gentle journal nudge only when nothing was written', () => {
    const goal: any = { id: 'g1', title: 'Goal', status: 'In Progress', milestones: [{ id: 'm1', title: 'Step', targetDate: '2026-03-05', done: false }] };
    const letter: any = { id: 'l1', title: 'Hi', recipient: 'Me', writtenOn: '2026-01-01', readOn: '2026-03-02', body: 'x' };
    const s = { ...settings, reminders: { ...settings.reminders, journal: { enabled: true, time: '21:00' } } };
    const noEntry = computeReminderInstances({ ...base, settings: s, events: [], goals: [goal], letters: [letter], now: eventAt });
    expect(noEntry.map((i) => i.kind).sort()).toEqual(['goal', 'goal', 'journal', 'letter']);
    const written = computeReminderInstances({ ...base, settings: s, events: [], goals: [], letters: [], journalDates: new Set(['2026-03-02']), now: eventAt });
    expect(written.find((i) => i.kind === 'journal')).toBeUndefined();
  });
});
