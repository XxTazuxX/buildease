import { describe, expect, it } from "vitest";
import {
  assignmentFormSchema,
  residentFormSchema,
  residentUpdateFormSchema,
} from "./occupancy";

describe("residentFormSchema", () => {
  const valid = { accountId: "a1", displayName: "Sam", phone: "" };
  it("requires an account and a name up to 120 characters, phone up to 40", () => {
    expect(residentFormSchema.safeParse(valid).success).toBe(true);
    expect(
      residentFormSchema.safeParse({ ...valid, accountId: "" }).success,
    ).toBe(false);
    expect(
      residentFormSchema.safeParse({ ...valid, displayName: " " }).success,
    ).toBe(false);
    expect(
      residentFormSchema.safeParse({ ...valid, displayName: "n".repeat(121) })
        .success,
    ).toBe(false);
    expect(
      residentFormSchema.safeParse({ ...valid, phone: "1".repeat(41) }).success,
    ).toBe(false);
  });
});

describe("residentUpdateFormSchema", () => {
  it("keeps the active flag and trims the name", () => {
    expect(
      residentUpdateFormSchema.parse({
        displayName: " Sam ",
        phone: "",
        active: false,
      }),
    ).toEqual({ displayName: "Sam", phone: "", active: false });
  });
});

describe("assignmentFormSchema", () => {
  it("requires both a resident and a space", () => {
    expect(
      assignmentFormSchema.safeParse({ residentId: "", spaceId: "s" }).success,
    ).toBe(false);
    expect(
      assignmentFormSchema.safeParse({ residentId: "r", spaceId: "" }).success,
    ).toBe(false);
    expect(
      assignmentFormSchema.safeParse({ residentId: "r", spaceId: "s" }).success,
    ).toBe(true);
  });
});
