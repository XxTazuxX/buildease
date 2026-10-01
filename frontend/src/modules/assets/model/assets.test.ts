import { describe, it, expect } from "vitest";
import { assetSchema, meterReadingSchema } from "./assets";

describe("meterReadingSchema", () => {
  it("parses a decimal value to a number and requires a unit", () => {
    expect(
      meterReadingSchema.parse({ value: "1200.5", unit: "hours" }),
    ).toEqual({ value: 1200.5, unit: "hours" });
    expect(meterReadingSchema.safeParse({ value: "", unit: "h" }).success).toBe(
      false,
    );
    expect(
      meterReadingSchema.safeParse({ value: "-1", unit: "h" }).success,
    ).toBe(false);
    expect(
      meterReadingSchema.safeParse({ value: "1.234", unit: "h" }).success,
    ).toBe(false);
    expect(
      meterReadingSchema.safeParse({ value: "1", unit: "x".repeat(25) })
        .success,
    ).toBe(false);
  });
});

describe("assetSchema limits", () => {
  const valid = { name: "Unit", category: "HVAC" as const };
  it("enforces the backend field lengths", () => {
    expect(
      assetSchema.safeParse({ ...valid, name: "n".repeat(161) }).success,
    ).toBe(false);
    expect(
      assetSchema.safeParse({ ...valid, manufacturer: "m".repeat(121) })
        .success,
    ).toBe(false);
    expect(
      assetSchema.safeParse({ ...valid, notes: "n".repeat(2001) }).success,
    ).toBe(false);
  });
  it("rejects impossible dates and turns blank dates into undefined", () => {
    expect(
      assetSchema.safeParse({ ...valid, installDate: "2026-02-30" }).success,
    ).toBe(false);
    expect(assetSchema.parse({ ...valid, installDate: "" }).installDate).toBe(
      undefined,
    );
  });
});

describe("assetSchema", () => {
  const valid = {
    name: "Rooftop HVAC Unit",
    category: "HVAC" as const,
  };
  it("accepts an asset with only a name and category", () => {
    expect(assetSchema.safeParse(valid).success).toBe(true);
  });
  it("accepts a blank optional space id but rejects a malformed one", () => {
    expect(assetSchema.safeParse({ ...valid, spaceId: "" }).success).toBe(true);
    expect(
      assetSchema.safeParse({ ...valid, spaceId: "not-a-uuid" }).success,
    ).toBe(false);
  });
  it("rejects a blank name", () => {
    expect(assetSchema.safeParse({ ...valid, name: "" }).success).toBe(false);
  });
});
