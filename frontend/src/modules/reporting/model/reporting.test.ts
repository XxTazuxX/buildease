import { describe, expect, it } from "vitest";
import { dateRangeErrors } from "./reporting";

describe("dateRangeErrors", () => {
  it("accepts an equal or ordered range", () => {
    expect(dateRangeErrors("2026-03-01", "2026-03-01")).toEqual({});
    expect(dateRangeErrors("2026-03-01", "2026-03-31")).toEqual({});
  });
  it("rejects an end before the start, on the end field", () => {
    expect(dateRangeErrors("2026-03-10", "2026-03-01")).toEqual({
      to: "The end date cannot be before the start date",
    });
  });
  it("asks for missing or impossible dates", () => {
    expect(dateRangeErrors("", "2026-03-01")).toEqual({ from: "Required" });
    expect(dateRangeErrors("2026-03-01", "")).toEqual({ to: "Required" });
    expect(dateRangeErrors("2026-02-30", "2026-03-01")).toEqual({
      from: "Enter a valid date",
    });
  });
});
