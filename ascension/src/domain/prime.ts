import type { DayRecord } from "./types";

/**
 * Prime scoring — the one number that tells Russ where today stands.
 *
 * The day is weighted toward execution (protocols + standards) over
 * consumption (hydration): winning the morning and holding standards is
 * what actually moves him toward Prime.
 */
const WEIGHTS = {
  morning: 0.3,
  night: 0.25,
  standards: 0.3,
  hydration: 0.15,
} as const;

/** A day counts as "held" — streak-worthy — at or above this score. */
export const PRIME_THRESHOLD = 70;

export type PrimeState = "Drifting" | "Building" | "Ascending" | "Prime";

export interface PrimeBreakdown {
  /** All components are 0..1. */
  morning: number;
  night: number;
  standards: number;
  hydration: number;
  /** 0..100. */
  score: number;
}

/** Fraction of a checklist completed. An empty checklist cannot fail. */
export function completion(map: Record<string, boolean>): number {
  const keys = Object.keys(map);
  if (keys.length === 0) return 1;
  const done = keys.filter((k) => map[k]).length;
  return done / keys.length;
}

export function primeBreakdown(day: DayRecord): PrimeBreakdown {
  const morning = completion(day.morning);
  const night = completion(day.night);
  const standards = completion(day.standards);
  const hydration =
    day.hydrationTargetMl > 0
      ? Math.min(1, day.hydrationMl / day.hydrationTargetMl)
      : 1;
  const score = Math.round(
    100 *
      (morning * WEIGHTS.morning +
        night * WEIGHTS.night +
        standards * WEIGHTS.standards +
        hydration * WEIGHTS.hydration),
  );
  return { morning, night, standards, hydration, score };
}

/** Sealed days keep their frozen score forever; open days score live. */
export function primeScore(day: DayRecord): number {
  return day.sealedScore ?? primeBreakdown(day).score;
}

export function primeState(score: number): PrimeState {
  if (score >= 90) return "Prime";
  if (score >= PRIME_THRESHOLD) return "Ascending";
  if (score >= 40) return "Building";
  return "Drifting";
}

export function isHeld(day: DayRecord): boolean {
  return primeScore(day) >= PRIME_THRESHOLD;
}
