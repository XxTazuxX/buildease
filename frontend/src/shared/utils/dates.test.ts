import { describe, expect, it } from "vitest";
import { daysUntil, formatDate, parseDate, todayIso } from "./dates";

describe("dates", () => {
  it("reads date-only values as local calendar dates", () => {
    const date = parseDate("2026-01-31");
    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([
      2026, 0, 31,
    ]);
  });

  it("formats missing or invalid values with a fallback", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate("not a date", "n/a")).toBe("n/a");
    expect(formatDate("2026-03-05")).toBe(
      new Date(2026, 2, 5).toLocaleDateString(),
    );
  });

  it("produces local YYYY-MM-DD strings, never shifted through UTC", () => {
    expect(todayIso(new Date(2026, 0, 1, 0, 30))).toBe("2026-01-01");
    expect(todayIso(new Date(2026, 11, 31, 23, 59))).toBe("2026-12-31");
  });

  it("counts whole days until a date", () => {
    const now = new Date(2026, 0, 10, 15, 0);
    expect(daysUntil("2026-01-24", now)).toBe(14);
    expect(daysUntil("2026-01-09", now)).toBe(-1);
  });
});
