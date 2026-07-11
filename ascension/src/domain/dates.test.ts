import { describe, expect, it } from "vitest";
import { addDays, fromDateKey, toDateKey } from "./dates";

describe("date keys", () => {
  it("round-trips through local time", () => {
    expect(toDateKey(fromDateKey("2026-07-11"))).toBe("2026-07-11");
    expect(toDateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-07-31", 1)).toBe("2026-08-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
  });
});
