/** Reminder evaluation. Pure functions: given the data and "now", decide what is due.
 *  The runtime (ReminderProvider) calls this on an interval while the app is open.
 *  Nothing here — or anywhere in the app — can fire while the app is closed. */
import type { CalendarEvent, CustomReminder, Goal, Letter, ReminderState, Settings } from '../data/types';
import { addDays, formatDate, formatTime, todayIn, zonedToInstant } from './dates';
import { expandMany } from './recurrence';

export type ReminderKind = 'event' | 'digest' | 'goal' | 'letter' | 'custom' | 'journal';

export interface ReminderInstance {
  key: string;
  kind: ReminderKind;
  title: string;
  body: string;
  dueAt: number;
  /** Where tapping the reminder should go. */
  route: string;
}

export interface ShownReminder extends ReminderInstance {
  missed: boolean;
  /** true when this call is the first time the engine has seen it due */
  fresh: boolean;
}

export interface ReminderInputs {
  events: CalendarEvent[];
  goals: Goal[];
  letters: Letter[];
  customReminders: CustomReminder[];
  journalDates: Set<string>;
  settings: Settings;
  now: number;
}

/** A reminder that becomes due while the app is awake is "on time" within this slack. */
export const MISSED_GRACE_MS = 3 * 60 * 1000;
/** Reminders older than this stop being listed at all. */
export const KEEP_MS = 3 * 24 * 3600 * 1000;
export const UPCOMING_MS = 36 * 3600 * 1000;
const ALL_DAY_ANCHOR = '09:00';

export const REMINDER_OFFSET_CHOICES = [0, 5, 10, 15, 30, 60, 120, 1440, 2880, 10080];

export function computeReminderInstances(inp: ReminderInputs): ReminderInstance[] {
  const { settings, now } = inp;
  const tz = settings.timezone;
  const today = todayIn(tz, now);
  const out: ReminderInstance[] = [];
  const tf = settings.timeFormat;
  const df = settings.dateFormat;
  const rangeStart = addDays(today, -4);
  const rangeEnd = addDays(today, 10);

  // ---- calendar events
  const occs = expandMany(inp.events, rangeStart, rangeEnd);
  for (const o of occs) {
    const ev = o.event;
    if (o.completed) continue;
    const etz = ev.timezone || tz;
    const startAt = zonedToInstant(o.date, ev.allDay ? ALL_DAY_ANCHOR : ev.startTime || ALL_DAY_ANCHOR, etz);
    for (const offset of ev.reminders ?? []) {
      const dueAt = startAt - offset * 60000;
      const when = ev.allDay ? `${formatDate(o.date, df, { weekday: true, short: true })} (all day)` : `${formatDate(o.date, df, { weekday: true, short: true })} at ${formatTime(ev.startTime, tf)}`;
      out.push({
        key: `ev:${ev.id}:${o.date}:${offset}`,
        kind: 'event',
        title: ev.title,
        body: offset === 0 ? `Starting now · ${when}${ev.location ? ` · ${ev.location}` : ''}` : `${when}${ev.location ? ` · ${ev.location}` : ''}`,
        dueAt,
        route: `/calendar?event=${encodeURIComponent(ev.id)}&date=${o.date}`,
      });
    }
  }

  // ---- same-day digest
  if (settings.reminders.digest.enabled) {
    for (let i = 0; i <= 1; i++) {
      const day = addDays(today, i);
      const todays = occs.filter((o) => o.date <= day && o.endDate >= day && !o.completed);
      if (!todays.length) continue;
      const names = todays.slice(0, 4).map((o) => (o.event.allDay ? o.event.title : `${formatTime(o.event.startTime, tf)} ${o.event.title}`));
      out.push({
        key: `digest:${day}`,
        kind: 'digest',
        title: todays.length === 1 ? 'One thing on today' : `${todays.length} things on today`,
        body: names.join(' · ') + (todays.length > 4 ? ` · +${todays.length - 4} more` : ''),
        dueAt: zonedToInstant(day, settings.reminders.digest.time, tz),
        route: `/calendar?view=day&date=${day}`,
      });
    }
  }

  // ---- goal milestones
  if (settings.reminders.goalMilestones.enabled) {
    const lead = Math.max(0, settings.reminders.goalMilestones.leadDays);
    for (const g of inp.goals) {
      if (g.status === 'Completed' || g.status === 'Archived') continue;
      for (const m of g.milestones ?? []) {
        if (m.done || !m.targetDate) continue;
        const dayOf = zonedToInstant(m.targetDate, ALL_DAY_ANCHOR, tz);
        out.push({
          key: `goal:${g.id}:${m.id}:day`, kind: 'goal', title: `Milestone today: ${m.title}`,
          body: `Part of “${g.title}”`, dueAt: dayOf, route: `/future?open=${encodeURIComponent(g.id)}`,
        });
        if (lead > 0) {
          out.push({
            key: `goal:${g.id}:${m.id}:lead${lead}`, kind: 'goal', title: `Milestone coming up: ${m.title}`,
            body: `${formatDate(m.targetDate, df, { short: true })} · part of “${g.title}”`,
            dueAt: zonedToInstant(addDays(m.targetDate, -lead), ALL_DAY_ANCHOR, tz), route: `/future?open=${encodeURIComponent(g.id)}`,
          });
        }
      }
    }
  }

  // ---- letters
  if (settings.reminders.letters) {
    for (const l of inp.letters) {
      if (!l.readOn || l.openedAt) continue;
      out.push({
        key: `letter:${l.id}:${l.readOn}`, kind: 'letter', title: `A letter is ready to read: ${l.title}`,
        body: `You wrote it for ${l.recipient} on ${formatDate(l.writtenOn, df, { short: true })}.`,
        dueAt: zonedToInstant(l.readOn, ALL_DAY_ANCHOR, tz), route: `/legacy/letters?open=${encodeURIComponent(l.id)}`,
      });
    }
  }

  // ---- custom reminders
  for (const c of inp.customReminders) {
    out.push({
      key: `custom:${c.id}`, kind: 'custom', title: c.title, body: c.note || formatDate(c.date, df, { weekday: true, short: true }),
      dueAt: zonedToInstant(c.date, c.time || ALL_DAY_ANCHOR, tz), route: '/calendar?view=agenda',
    });
  }

  // ---- gentle journal nudge (today only, skipped if anything was already written)
  if (settings.reminders.journal.enabled && !inp.journalDates.has(today)) {
    out.push({
      key: `journal:${today}`, kind: 'journal', title: 'Your journal is open whenever you are',
      body: 'No pressure — even a line is enough.', dueAt: zonedToInstant(today, settings.reminders.journal.time, tz), route: '/journal/new',
    });
  }

  return out;
}

export interface Evaluation {
  /** Currently due and not dismissed — what the bell shows. */
  due: ShownReminder[];
  /** Due within the next 36h. */
  upcoming: ReminderInstance[];
  /** State rows the runtime must persist (first sight / re-fire after snooze). */
  toMark: ReminderState[];
}

export function evaluateReminders(instances: ReminderInstance[], states: Map<string, ReminderState>, now: number): Evaluation {
  const due: ShownReminder[] = [];
  const upcoming: ReminderInstance[] = [];
  const toMark: ReminderState[] = [];
  const seenKeys = new Set<string>();
  for (const inst of instances) {
    if (seenKeys.has(inst.key)) continue; // duplicate prevention
    seenKeys.add(inst.key);
    const st = states.get(inst.key);
    if (st?.status === 'dismissed') continue;
    let effectiveDue = inst.dueAt;
    if (st?.status === 'snoozed' && st.snoozeUntil) {
      if (st.snoozeUntil > now) {
        if (st.snoozeUntil - now <= UPCOMING_MS) upcoming.push({ ...inst, dueAt: st.snoozeUntil });
        continue;
      }
      effectiveDue = st.snoozeUntil; // snooze elapsed: due again
    }
    if (effectiveDue > now) {
      if (effectiveDue - now <= UPCOMING_MS) upcoming.push({ ...inst, dueAt: effectiveDue });
      continue;
    }
    if (now - effectiveDue > KEEP_MS) continue;

    if (st?.status === 'fired') {
      due.push({ ...inst, dueAt: effectiveDue, missed: st.missed, fresh: false });
    } else {
      // first time we see it as due (never seen, or snooze just elapsed)
      const missed = now - effectiveDue > MISSED_GRACE_MS;
      toMark.push({ key: inst.key, status: 'fired', seenAt: now, missed, browserNotified: false });
      due.push({ ...inst, dueAt: effectiveDue, missed, fresh: true });
    }
  }
  due.sort((a, b) => b.dueAt - a.dueAt);
  upcoming.sort((a, b) => a.dueAt - b.dueAt);
  return { due, upcoming, toMark };
}
