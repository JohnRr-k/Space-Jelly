import { describe, expect, it } from "vitest";
import { createDayRecord } from "./day";
import {
  DEFAULT_MORNING_STEPS,
  DEFAULT_NIGHT_STEPS,
  DEFAULT_PROFILE,
  DEFAULT_STANDARDS,
} from "./defaults";
import {
  completion,
  isHeld,
  primeBreakdown,
  primeScore,
  primeState,
} from "./prime";
import type { DayRecord } from "./types";

function freshDay(): DayRecord {
  return createDayRecord(
    "2026-07-11",
    DEFAULT_MORNING_STEPS,
    DEFAULT_NIGHT_STEPS,
    DEFAULT_STANDARDS,
    DEFAULT_PROFILE,
  );
}

function perfectDay(): DayRecord {
  const day = freshDay();
  for (const k of Object.keys(day.morning)) day.morning[k] = true;
  for (const k of Object.keys(day.night)) day.night[k] = true;
  for (const k of Object.keys(day.standards)) day.standards[k] = true;
  day.hydrationMl = day.hydrationTargetMl;
  return day;
}

describe("completion", () => {
  it("is 0 for an untouched checklist and 1 when everything is done", () => {
    expect(completion({ a: false, b: false })).toBe(0);
    expect(completion({ a: true, b: true })).toBe(1);
    expect(completion({ a: true, b: false })).toBe(0.5);
  });

  it("treats an empty checklist as complete rather than failed", () => {
    expect(completion({})).toBe(1);
  });
});

describe("primeBreakdown", () => {
  it("scores 0 for an untouched day and 100 for a perfect day", () => {
    expect(primeBreakdown(freshDay()).score).toBe(0);
    expect(primeBreakdown(perfectDay()).score).toBe(100);
  });

  it("weights pillars: a perfect morning alone contributes 30 points", () => {
    const day = freshDay();
    for (const k of Object.keys(day.morning)) day.morning[k] = true;
    expect(primeBreakdown(day).score).toBe(30);
  });

  it("caps hydration credit at the target", () => {
    const day = freshDay();
    day.hydrationMl = day.hydrationTargetMl * 3;
    expect(primeBreakdown(day).hydration).toBe(1);
    expect(primeBreakdown(day).score).toBe(15);
  });

  it("never fails hydration when the target is zero", () => {
    const day = freshDay();
    day.hydrationTargetMl = 0;
    expect(primeBreakdown(day).hydration).toBe(1);
  });
});

describe("primeScore", () => {
  it("prefers the frozen sealed score over a live computation", () => {
    const day = perfectDay();
    day.sealedScore = 84;
    expect(primeScore(day)).toBe(84);
    expect(primeScore(perfectDay())).toBe(100);
  });
});

describe("primeState", () => {
  it("maps score bands to states at the documented boundaries", () => {
    expect(primeState(0)).toBe("Drifting");
    expect(primeState(39)).toBe("Drifting");
    expect(primeState(40)).toBe("Building");
    expect(primeState(69)).toBe("Building");
    expect(primeState(70)).toBe("Ascending");
    expect(primeState(89)).toBe("Ascending");
    expect(primeState(90)).toBe("Prime");
    expect(primeState(100)).toBe("Prime");
  });
});

describe("isHeld", () => {
  it("holds a day at the streak threshold", () => {
    const day = perfectDay();
    day.sealedScore = 70;
    expect(isHeld(day)).toBe(true);
    day.sealedScore = 69;
    expect(isHeld(day)).toBe(false);
  });
});
