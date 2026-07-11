import { seasonOf } from "./context";
import { toDateKey } from "./dates";
import type {
  DayPhase,
  Fragrance,
  FragranceProfile,
  Outfit,
  OutfitOccasion,
} from "./types";

/**
 * The recommendation engine — ASCENSION deciding so Russ doesn't have to.
 *
 * Rules are deterministic per calendar date: the same day always produces the
 * same recommendation, so the app never second-guesses itself between opens.
 * The engine is a set of pure functions behind simple signatures, so a
 * smarter (weather-aware, model-backed) engine can replace it without
 * touching any UI.
 */

/** Small stable hash so a date maps to a consistent pick within a list. */
function hashKey(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function pickFor<T>(items: T[], date: Date, salt: string): T {
  return items[hashKey(toDateKey(date) + salt) % items.length];
}

/** What the week asks of him: sharper toward Friday, easier on weekends. */
export function occasionsForWeekday(weekday: number): OutfitOccasion[] {
  switch (weekday) {
    case 0: // Sunday
      return ["training", "casual"];
    case 5: // Friday
      return ["sharp", "smart"];
    case 6: // Saturday
      return ["casual", "smart"];
    default: // Monday–Thursday
      return ["smart", "casual"];
  }
}

export function recommendOutfit(
  outfits: Outfit[],
  date: Date,
): Outfit | undefined {
  if (outfits.length === 0) return undefined;
  for (const occasion of occasionsForWeekday(date.getDay())) {
    const matching = outfits.filter((o) => o.occasion === occasion);
    if (matching.length > 0) return pickFor(matching, date, "outfit");
  }
  return pickFor(outfits, date, "outfit");
}

/** Fresh for daylight, warm for evenings, intense for weekend nights. */
export function fragranceProfilesFor(
  phase: DayPhase,
  date: Date,
): FragranceProfile[] {
  const weekend = date.getDay() === 5 || date.getDay() === 6;
  const cold = seasonOf(date) === "winter" || seasonOf(date) === "autumn";
  if (phase === "evening" || phase === "night") {
    return weekend ? ["intense", "warm", "fresh"] : ["warm", "intense", "fresh"];
  }
  return cold ? ["warm", "fresh", "intense"] : ["fresh", "warm", "intense"];
}

export function recommendFragrance(
  fragrances: Fragrance[],
  date: Date,
  phase: DayPhase,
): Fragrance | undefined {
  if (fragrances.length === 0) return undefined;
  for (const profile of fragranceProfilesFor(phase, date)) {
    const matching = fragrances.filter((f) => f.profile === profile);
    if (matching.length > 0) return pickFor(matching, date, "fragrance");
  }
  return pickFor(fragrances, date, "fragrance");
}
