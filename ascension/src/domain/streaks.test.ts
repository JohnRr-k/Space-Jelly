import { describe, expect, it } from "vitest";
import { bestStreak, currentStreak } from "./streaks";
import type { DateKey, DayRecord } from "./types";

/** Minimal sealed day at a given score. */
function day(date: DateKey, score: number): DayRecord {
  return {
    date,
    morning: {},
    night: {},
    standards: {},
    hydrationMl: 0,
    hydrationTargetMl: 3000,
    sealedScore: score,
  };
}

function record(entries: [DateKey, number][]): Record<DateKey, DayRecord> {
  return Object.fromEntries(entries.map(([d, s]) => [d, day(d, s)]));
}

describe("currentStreak", () => {
  it("counts consecutive held days ending yesterday when today is unfinished", () => {
    const days = record([
      ["2026-07-08", 80],
      ["2026-07-09", 75],
      ["2026-07-10", 90],
      ["2026-07-11", 10], // today, still open and low — must not break the run
    ]);
    expect(currentStreak(days, "2026-07-11")).toBe(3);
  });

  it("includes today once today is held", () => {
    const days = record([
      ["2026-07-10", 90],
      ["2026-07-11", 71],
    ]);
    expect(currentStreak(days, "2026-07-11")).toBe(2);
  });

  it("breaks on a missing calendar day", () => {
    const days = record([
      ["2026-07-07", 95],
      ["2026-07-08", 95],
      // 2026-07-09 never opened
      ["2026-07-10", 95],
    ]);
    expect(currentStreak(days, "2026-07-11")).toBe(1);
  });

  it("breaks on a day below threshold", () => {
    const days = record([
      ["2026-07-09", 95],
      ["2026-07-10", 40],
    ]);
    expect(currentStreak(days, "2026-07-11")).toBe(0);
  });

  it("crosses month boundaries", () => {
    const days = record([
      ["2026-06-29", 80],
      ["2026-06-30", 80],
      ["2026-07-01", 80],
    ]);
    expect(currentStreak(days, "2026-07-01")).toBe(3);
  });
});

describe("bestStreak", () => {
  it("finds the longest run across gaps", () => {
    const days = record([
      ["2026-06-01", 80],
      ["2026-06-02", 80],
      // gap
      ["2026-06-10", 80],
      ["2026-06-11", 80],
      ["2026-06-12", 80],
      ["2026-06-13", 30], // breaks the run
      ["2026-06-14", 80],
    ]);
    expect(bestStreak(days)).toBe(3);
  });

  it("is 0 with no held days", () => {
    expect(bestStreak(record([["2026-06-01", 10]]))).toBe(0);
    expect(bestStreak({})).toBe(0);
  });
});
