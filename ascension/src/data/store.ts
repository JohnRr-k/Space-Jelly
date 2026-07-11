import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createDayRecord } from "../domain/day";
import { todayKey } from "../domain/dates";
import {
  DEFAULT_FRAGRANCES,
  DEFAULT_MORNING_STEPS,
  DEFAULT_NIGHT_STEPS,
  DEFAULT_PROFILE,
  DEFAULT_OUTFITS,
  DEFAULT_STANDARDS,
} from "../domain/defaults";
import { uid } from "../domain/id";
import { primeBreakdown } from "../domain/prime";
import type {
  DateKey,
  DayRecord,
  Fragrance,
  Outfit,
  Profile,
  ProtocolStepDef,
  Reflection,
  StandardDef,
} from "../domain/types";

/**
 * The single source of truth, persisted to localStorage.
 *
 * ASCENSION is local-first by design: it is built for exactly one person,
 * so his data lives on his device and nowhere else. The persist layer is
 * versioned (`version` below) so future schema changes migrate instead of
 * wiping history.
 *
 * Rules enforced here rather than in the UI:
 *  - a sealed day is immutable until explicitly reopened;
 *  - editing protocols/standards updates *today's* open record but never
 *    rewrites past days (their checklists are snapshots).
 */

interface AscensionState {
  profile: Profile;
  morningSteps: ProtocolStepDef[];
  nightSteps: ProtocolStepDef[];
  standards: StandardDef[];
  outfits: Outfit[];
  fragrances: Fragrance[];
  days: Record<DateKey, DayRecord>;

  ensureDay: (date: DateKey) => void;
  toggleMorning: (date: DateKey, id: string) => void;
  toggleNight: (date: DateKey, id: string) => void;
  toggleStandard: (date: DateKey, id: string) => void;
  addHydration: (date: DateKey, deltaMl: number) => void;
  setOutfit: (date: DateKey, outfitId: string) => void;
  setFragrance: (date: DateKey, fragranceId: string) => void;
  setIntention: (date: DateKey, text: string) => void;
  sealDay: (date: DateKey, reflection: Reflection) => void;
  reopenDay: (date: DateKey) => void;

  updateProfile: (patch: Partial<Profile>) => void;
  addMorningStep: (item: Omit<ProtocolStepDef, "id">) => void;
  removeMorningStep: (id: string) => void;
  addNightStep: (item: Omit<ProtocolStepDef, "id">) => void;
  removeNightStep: (id: string) => void;
  addStandard: (item: Omit<StandardDef, "id">) => void;
  removeStandard: (id: string) => void;
  addOutfit: (item: Omit<Outfit, "id">) => void;
  removeOutfit: (id: string) => void;
  addFragrance: (item: Omit<Fragrance, "id">) => void;
  removeFragrance: (id: string) => void;
  resetAll: () => void;
}

function initialData() {
  return {
    profile: DEFAULT_PROFILE,
    morningSteps: DEFAULT_MORNING_STEPS,
    nightSteps: DEFAULT_NIGHT_STEPS,
    standards: DEFAULT_STANDARDS,
    outfits: DEFAULT_OUTFITS,
    fragrances: DEFAULT_FRAGRANCES,
    days: {} as Record<DateKey, DayRecord>,
  };
}

/** Apply `patch` to an *open* day; sealed days ignore every write. */
function patchOpenDay(
  days: Record<DateKey, DayRecord>,
  date: DateKey,
  patch: (day: DayRecord) => Partial<DayRecord>,
): Record<DateKey, DayRecord> | null {
  const day = days[date];
  if (!day || day.sealedAt) return null;
  return { ...days, [date]: { ...day, ...patch(day) } };
}

function toggled(
  map: Record<string, boolean>,
  id: string,
): Record<string, boolean> {
  return id in map ? { ...map, [id]: !map[id] } : map;
}

/**
 * Keep today's open checklist in sync when the configuration changes:
 * new items become trackable immediately, removed items disappear —
 * but only for today; history keeps its snapshot.
 */
function syncTodayChecklist(
  days: Record<DateKey, DayRecord>,
  field: "morning" | "night" | "standards",
  change: { add?: string; remove?: string },
): Record<DateKey, DayRecord> {
  const today = todayKey();
  const patched = patchOpenDay(days, today, (day) => {
    const map = { ...day[field] };
    if (change.add) map[change.add] = false;
    if (change.remove) delete map[change.remove];
    return { [field]: map };
  });
  return patched ?? days;
}

export const useAscension = create<AscensionState>()(
  persist(
    (set, get) => ({
      ...initialData(),

      ensureDay: (date) => {
        const s = get();
        if (s.days[date]) return;
        set({
          days: {
            ...s.days,
            [date]: createDayRecord(
              date,
              s.morningSteps,
              s.nightSteps,
              s.standards,
              s.profile,
            ),
          },
        });
      },

      toggleMorning: (date, id) =>
        set((s) => {
          const days = patchOpenDay(s.days, date, (d) => ({
            morning: toggled(d.morning, id),
          }));
          return days ? { days } : s;
        }),

      toggleNight: (date, id) =>
        set((s) => {
          const days = patchOpenDay(s.days, date, (d) => ({
            night: toggled(d.night, id),
          }));
          return days ? { days } : s;
        }),

      toggleStandard: (date, id) =>
        set((s) => {
          const days = patchOpenDay(s.days, date, (d) => ({
            standards: toggled(d.standards, id),
          }));
          return days ? { days } : s;
        }),

      addHydration: (date, deltaMl) =>
        set((s) => {
          const days = patchOpenDay(s.days, date, (d) => ({
            hydrationMl: Math.max(0, d.hydrationMl + deltaMl),
          }));
          return days ? { days } : s;
        }),

      setOutfit: (date, outfitId) =>
        set((s) => {
          const days = patchOpenDay(s.days, date, () => ({ outfitId }));
          return days ? { days } : s;
        }),

      setFragrance: (date, fragranceId) =>
        set((s) => {
          const days = patchOpenDay(s.days, date, () => ({ fragranceId }));
          return days ? { days } : s;
        }),

      setIntention: (date, text) =>
        set((s) => {
          const days = patchOpenDay(s.days, date, () => ({
            intention: text,
          }));
          return days ? { days } : s;
        }),

      sealDay: (date, reflection) =>
        set((s) => {
          const days = patchOpenDay(s.days, date, (d) => ({
            reflection,
            sealedAt: new Date().toISOString(),
            sealedScore: primeBreakdown(d).score,
          }));
          return days ? { days } : s;
        }),

      reopenDay: (date) =>
        set((s) => {
          const day = s.days[date];
          if (!day || !day.sealedAt) return s;
          const reopened: DayRecord = { ...day };
          delete reopened.sealedAt;
          delete reopened.sealedScore;
          return { days: { ...s.days, [date]: reopened } };
        }),

      updateProfile: (patch) =>
        set((s) => {
          const profile = { ...s.profile, ...patch };
          // A new hydration target applies to today's open record too;
          // past days keep the target they were lived under.
          let days = s.days;
          if (
            patch.hydrationTargetMl !== undefined &&
            patch.hydrationTargetMl !== s.profile.hydrationTargetMl
          ) {
            days =
              patchOpenDay(days, todayKey(), () => ({
                hydrationTargetMl: patch.hydrationTargetMl,
              })) ?? days;
          }
          return { profile, days };
        }),

      addMorningStep: (item) =>
        set((s) => {
          const step = { ...item, id: uid() };
          return {
            morningSteps: [...s.morningSteps, step],
            days: syncTodayChecklist(s.days, "morning", { add: step.id }),
          };
        }),

      removeMorningStep: (id) =>
        set((s) => ({
          morningSteps: s.morningSteps.filter((i) => i.id !== id),
          days: syncTodayChecklist(s.days, "morning", { remove: id }),
        })),

      addNightStep: (item) =>
        set((s) => {
          const step = { ...item, id: uid() };
          return {
            nightSteps: [...s.nightSteps, step],
            days: syncTodayChecklist(s.days, "night", { add: step.id }),
          };
        }),

      removeNightStep: (id) =>
        set((s) => ({
          nightSteps: s.nightSteps.filter((i) => i.id !== id),
          days: syncTodayChecklist(s.days, "night", { remove: id }),
        })),

      addStandard: (item) =>
        set((s) => {
          const standard = { ...item, id: uid() };
          return {
            standards: [...s.standards, standard],
            days: syncTodayChecklist(s.days, "standards", {
              add: standard.id,
            }),
          };
        }),

      removeStandard: (id) =>
        set((s) => ({
          standards: s.standards.filter((i) => i.id !== id),
          days: syncTodayChecklist(s.days, "standards", { remove: id }),
        })),

      addOutfit: (item) =>
        set((s) => ({ outfits: [...s.outfits, { ...item, id: uid() }] })),

      removeOutfit: (id) =>
        set((s) => ({ outfits: s.outfits.filter((i) => i.id !== id) })),

      addFragrance: (item) =>
        set((s) => ({
          fragrances: [...s.fragrances, { ...item, id: uid() }],
        })),

      removeFragrance: (id) =>
        set((s) => ({ fragrances: s.fragrances.filter((i) => i.id !== id) })),

      resetAll: () => set({ ...initialData() }),
    }),
    {
      name: "ascension-v1",
      version: 1,
    },
  ),
);
