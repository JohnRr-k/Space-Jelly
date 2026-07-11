import { addDays } from "./dates";
import { isHeld } from "./prime";
import type { DateKey, DayRecord } from "./types";

/**
 * Streaks measure consecutive calendar days held at or above the Prime
 * threshold. A missing day (app never opened) breaks a streak — showing up
 * is part of the standard.
 */

/**
 * Current streak ending at `today`. Today extends the streak once held, but
 * an unfinished today never breaks it — the count then runs to yesterday.
 */
export function currentStreak(
  days: Record<DateKey, DayRecord>,
  today: DateKey,
): number {
  let streak = 0;
  const todayRecord = days[today];
  if (todayRecord && isHeld(todayRecord)) streak += 1;

  let cursor = addDays(today, -1);
  while (true) {
    const record = days[cursor];
    if (record && isHeld(record)) {
      streak += 1;
      cursor = addDays(cursor, -1);
    } else {
      break;
    }
  }
  return streak;
}

/** Longest run of consecutive held days anywhere in history. */
export function bestStreak(days: Record<DateKey, DayRecord>): number {
  const heldKeys = Object.keys(days)
    .filter((k) => isHeld(days[k]))
    .sort();
  let best = 0;
  let run = 0;
  let prev: DateKey | undefined;
  for (const key of heldKeys) {
    run = prev !== undefined && addDays(prev, 1) === key ? run + 1 : 1;
    best = Math.max(best, run);
    prev = key;
  }
  return best;
}
