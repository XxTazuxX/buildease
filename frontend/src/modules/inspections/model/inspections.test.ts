import { describe, it, expect } from "vitest";
import { createInspectionSchema, itemSchema } from "./inspections";

describe("createInspectionSchema", () => {
  const valid = {
    spaceId: "11111111-1111-1111-1111-111111111111",
    type: "MOVE_IN" as const,
    scheduledOn: "2026-01-01",
  };
  it("accepts a well-formed inspection without lease or resident", () => {
    expect(createInspectionSchema.safeParse(valid).success).toBe(true);
  });
  it("rejects a non-uuid space", () => {
    expect(
      createInspectionSchema.safeParse({ ...valid, spaceId: "nope" }).success,
    ).toBe(false);
  });
  it("rejects a missing scheduled date", () => {
    expect(
      createInspectionSchema.safeParse({ ...valid, scheduledOn: "" }).success,
    ).toBe(false);
  });
});

describe("itemSchema", () => {
  it("accepts a checklist item without notes", () => {
    expect(
      itemSchema.safeParse({ area: "Kitchen", condition: "GOOD" }).success,
    ).toBe(true);
  });
  it("rejects a blank area", () => {
    expect(itemSchema.safeParse({ area: "", condition: "GOOD" }).success).toBe(
      false,
    );
  });
});
