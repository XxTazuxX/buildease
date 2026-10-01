import { describe, it, expect } from "vitest";
import {
  createInspectionSchema,
  inspectionFormSchema,
  itemSchema,
} from "./inspections";

describe("inspectionFormSchema", () => {
  const valid = {
    spaceId: "s1",
    residentId: "",
    type: "MOVE_IN",
    scheduledOn: "2026-02-01",
  };
  it("requires a space, a type and a real scheduled date", () => {
    expect(inspectionFormSchema.safeParse(valid).success).toBe(true);
    expect(
      inspectionFormSchema.safeParse({ ...valid, spaceId: "" }).success,
    ).toBe(false);
    expect(
      inspectionFormSchema.safeParse({ ...valid, type: "" }).success,
    ).toBe(false);
    expect(
      inspectionFormSchema.safeParse({ ...valid, scheduledOn: "" }).success,
    ).toBe(false);
    expect(
      inspectionFormSchema.safeParse({ ...valid, scheduledOn: "2026-02-30" })
        .success,
    ).toBe(false);
  });
});

describe("itemSchema limits", () => {
  it("requires an area up to 120 characters and notes up to 500", () => {
    const ok = { area: "Kitchen", condition: "GOOD" };
    expect(itemSchema.safeParse(ok).success).toBe(true);
    expect(itemSchema.safeParse({ ...ok, area: " " }).success).toBe(false);
    expect(itemSchema.safeParse({ ...ok, area: "a".repeat(121) }).success).toBe(
      false,
    );
    expect(itemSchema.safeParse({ ...ok, notes: "n".repeat(501) }).success).toBe(
      false,
    );
    expect(itemSchema.safeParse({ ...ok, condition: "" }).success).toBe(false);
  });
});

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
