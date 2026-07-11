import type {
  DateKey,
  DayRecord,
  Profile,
  ProtocolStepDef,
  StandardDef,
} from "./types";

/**
 * Create the record for a fresh day, snapshotting the current configuration
 * so later edits to protocols or standards never rewrite history.
 */
export function createDayRecord(
  date: DateKey,
  morningSteps: ProtocolStepDef[],
  nightSteps: ProtocolStepDef[],
  standards: StandardDef[],
  profile: Profile,
): DayRecord {
  const asMap = (items: { id: string }[]) =>
    Object.fromEntries(items.map((item) => [item.id, false]));
  return {
    date,
    morning: asMap(morningSteps),
    night: asMap(nightSteps),
    standards: asMap(standards),
    hydrationMl: 0,
    hydrationTargetMl: profile.hydrationTargetMl,
  };
}

export function countDone(map: Record<string, boolean>): {
  done: number;
  total: number;
} {
  const keys = Object.keys(map);
  return { done: keys.filter((k) => map[k]).length, total: keys.length };
}
