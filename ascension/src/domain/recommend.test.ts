import { describe, expect, it } from "vitest";
import { DEFAULT_FRAGRANCES, DEFAULT_OUTFITS } from "./defaults";
import {
  fragranceProfilesFor,
  occasionsForWeekday,
  recommendFragrance,
  recommendOutfit,
} from "./recommend";

// 2026-07-10 is a Friday, 2026-07-12 a Sunday, 2026-07-13 a Monday.
const friday = new Date(2026, 6, 10, 9, 0);
const sunday = new Date(2026, 6, 12, 9, 0);
const monday = new Date(2026, 6, 13, 9, 0);

describe("recommendOutfit", () => {
  it("is deterministic for a given date", () => {
    const a = recommendOutfit(DEFAULT_OUTFITS, monday);
    const b = recommendOutfit(DEFAULT_OUTFITS, monday);
    expect(a?.id).toBe(b?.id);
  });

  it("prefers sharp on Friday, training/casual on Sunday, smart on Monday", () => {
    expect(recommendOutfit(DEFAULT_OUTFITS, friday)?.occasion).toBe("sharp");
    expect(["training", "casual"]).toContain(
      recommendOutfit(DEFAULT_OUTFITS, sunday)?.occasion,
    );
    expect(recommendOutfit(DEFAULT_OUTFITS, monday)?.occasion).toBe("smart");
  });

  it("falls back to any outfit when no occasion matches", () => {
    const onlySharp = DEFAULT_OUTFITS.filter((o) => o.occasion === "sharp");
    expect(recommendOutfit(onlySharp, sunday)?.occasion).toBe("sharp");
  });

  it("returns undefined for an empty wardrobe", () => {
    expect(recommendOutfit([], monday)).toBeUndefined();
  });
});

describe("recommendFragrance", () => {
  it("prefers fresh in a summer morning and warm on a weekday evening", () => {
    expect(recommendFragrance(DEFAULT_FRAGRANCES, monday, "morning")?.profile).toBe(
      "fresh",
    );
    expect(
      recommendFragrance(DEFAULT_FRAGRANCES, monday, "evening")?.profile,
    ).toBe("warm");
  });

  it("goes intense on weekend evenings", () => {
    expect(
      recommendFragrance(DEFAULT_FRAGRANCES, friday, "evening")?.profile,
    ).toBe("intense");
  });

  it("returns undefined with no fragrances configured", () => {
    expect(recommendFragrance([], monday, "morning")).toBeUndefined();
  });
});

describe("weekday tables", () => {
  it("covers every weekday with at least one occasion", () => {
    for (let d = 0; d <= 6; d++) {
      expect(occasionsForWeekday(d).length).toBeGreaterThan(0);
    }
  });

  it("orders every fragrance profile for every phase", () => {
    for (const phase of ["morning", "day", "evening", "night"] as const) {
      expect(fragranceProfilesFor(phase, monday)).toHaveLength(3);
    }
  });
});
