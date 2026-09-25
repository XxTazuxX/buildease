import { describe, it, expect } from "vitest";
import { assetSchema } from "./assets";

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
