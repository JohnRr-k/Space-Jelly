/**
 * Core domain types.
 *
 * The domain layer is pure TypeScript with zero React / storage dependencies.
 * Everything the UI shows is derived from these structures by pure functions,
 * which keeps the business rules testable and the UI disposable.
 */

/** Calendar date in local time, formatted YYYY-MM-DD. */
export type DateKey = string;

export type DayPhase = "morning" | "day" | "evening" | "night";

export type Season = "spring" | "summer" | "autumn" | "winter";

export interface Profile {
  name: string;
  /** "HH:MM" 24h — target wake time. */
  wakeTime: string;
  /** "HH:MM" 24h — target lights-out. */
  sleepTime: string;
  hydrationTargetMl: number;
  /** One tap on the hydration control adds this much. */
  hydrationStepMl: number;
}

/** A non-negotiable behavior Russ holds every day (posture, speech, presence…). */
export interface StandardDef {
  id: string;
  title: string;
  /** The one-line "why" shown under the title. */
  detail?: string;
}

/** One step of the Morning or Night Protocol. Order in the array is ritual order. */
export interface ProtocolStepDef {
  id: string;
  title: string;
  detail?: string;
}

export type OutfitOccasion = "training" | "casual" | "smart" | "sharp";

export interface Outfit {
  id: string;
  name: string;
  occasion: OutfitOccasion;
  /** What the outfit actually is — "Dark denim, white tee, white sneakers." */
  note?: string;
}

export type FragranceProfile = "fresh" | "warm" | "intense";

export interface Fragrance {
  id: string;
  name: string;
  profile: FragranceProfile;
  note?: string;
}

export interface Reflection {
  win: string;
  friction: string;
  tomorrow: string;
  /** 1–5 self-assessment: how close to Prime was today? */
  rating?: number;
}

/**
 * Everything recorded about one calendar day.
 *
 * The checklist maps snapshot the step/standard ids that existed when the day
 * was created, so editing the configuration later never rewrites history.
 * `hydrationTargetMl` is snapshotted for the same reason.
 */
export interface DayRecord {
  date: DateKey;
  morning: Record<string, boolean>;
  night: Record<string, boolean>;
  standards: Record<string, boolean>;
  hydrationMl: number;
  hydrationTargetMl: number;
  outfitId?: string;
  fragranceId?: string;
  /** One line set in the morning: what must be true by tonight. */
  intention?: string;
  reflection?: Reflection;
  /** ISO timestamp — set when the Night Protocol seals the day. */
  sealedAt?: string;
  /** Prime score frozen at seal time, so history never drifts. */
  sealedScore?: number;
}
