import type { DayPhase, Season } from "./types";

/**
 * The context engine: where ASCENSION's "quiet awareness" of time lives.
 * Every screen adapts to the phase of day so Russ never has to decide
 * what to look at — the app has already decided.
 */

export function dayPhase(now: Date): DayPhase {
  const h = now.getHours();
  if (h < 4) return "night";
  if (h < 11) return "morning";
  if (h < 17) return "day";
  if (h < 22) return "evening";
  return "night";
}

export function greeting(phase: DayPhase, name: string): string {
  switch (phase) {
    case "morning":
      return `Good morning, ${name}.`;
    case "day":
      return `Stay sharp, ${name}.`;
    case "evening":
      return `Good evening, ${name}.`;
    case "night":
      return `Wind down, ${name}.`;
  }
}

/** The single quiet directive under the greeting. */
export function phaseDirective(phase: DayPhase): string {
  switch (phase) {
    case "morning":
      return "Run the protocol. Win the first hour.";
    case "day":
      return "Hold your standards. Stay hydrated.";
    case "evening":
      return "Begin the descent. Prepare tomorrow.";
    case "night":
      return "Seal the day. Let it go.";
  }
}

/** Meteorological seasons, northern hemisphere. */
export function seasonOf(d: Date): Season {
  const m = d.getMonth(); // 0-based
  if (m >= 2 && m <= 4) return "spring";
  if (m >= 5 && m <= 7) return "summer";
  if (m >= 8 && m <= 10) return "autumn";
  return "winter";
}
