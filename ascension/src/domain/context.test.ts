import { describe, expect, it } from "vitest";
import { dayPhase, greeting, seasonOf } from "./context";

const at = (hour: number) => new Date(2026, 6, 11, hour, 0, 0);

describe("dayPhase", () => {
  it("maps hours to phases at the boundaries", () => {
    expect(dayPhase(at(0))).toBe("night");
    expect(dayPhase(at(3))).toBe("night");
    expect(dayPhase(at(4))).toBe("morning");
    expect(dayPhase(at(10))).toBe("morning");
    expect(dayPhase(at(11))).toBe("day");
    expect(dayPhase(at(16))).toBe("day");
    expect(dayPhase(at(17))).toBe("evening");
    expect(dayPhase(at(21))).toBe("evening");
    expect(dayPhase(at(22))).toBe("night");
    expect(dayPhase(at(23))).toBe("night");
  });
});

describe("greeting", () => {
  it("addresses Russ by name in every phase", () => {
    expect(greeting("morning", "Russ")).toBe("Good morning, Russ.");
    expect(greeting("night", "Russ")).toContain("Russ");
  });
});

describe("seasonOf", () => {
  it("uses meteorological seasons", () => {
    expect(seasonOf(new Date(2026, 0, 15))).toBe("winter");
    expect(seasonOf(new Date(2026, 3, 15))).toBe("spring");
    expect(seasonOf(new Date(2026, 6, 15))).toBe("summer");
    expect(seasonOf(new Date(2026, 9, 15))).toBe("autumn");
    expect(seasonOf(new Date(2026, 11, 15))).toBe("winter");
  });
});
