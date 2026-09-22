import { describe, it, expect } from "vitest";
import { leaseSchema } from "./leases";

describe("leaseSchema", () => {
  const valid = {
    residentId: "11111111-1111-1111-1111-111111111111",
    spaceId: "22222222-2222-2222-2222-222222222222",
    startsOn: "2026-01-01",
    rentAmount: 1200,
    firstChargeOn: "2026-01-01",
  };
  it("accepts a well-formed lease", () => {
    expect(leaseSchema.safeParse(valid).success).toBe(true);
  });
  it("rejects a non-uuid resident or space", () => {
    expect(
      leaseSchema.safeParse({ ...valid, residentId: "not-a-uuid" }).success,
    ).toBe(false);
    expect(
      leaseSchema.safeParse({ ...valid, spaceId: "not-a-uuid" }).success,
    ).toBe(false);
  });
  it("rejects a non-positive rent amount", () => {
    expect(leaseSchema.safeParse({ ...valid, rentAmount: 0 }).success).toBe(
      false,
    );
    expect(leaseSchema.safeParse({ ...valid, rentAmount: -5 }).success).toBe(
      false,
    );
  });
  it("rejects missing start or first-charge dates", () => {
    expect(leaseSchema.safeParse({ ...valid, startsOn: "" }).success).toBe(
      false,
    );
    expect(leaseSchema.safeParse({ ...valid, firstChargeOn: "" }).success).toBe(
      false,
    );
  });
  it("accepts an optional deposit amount of zero but rejects a negative one", () => {
    expect(leaseSchema.safeParse({ ...valid, depositAmount: 0 }).success).toBe(
      true,
    );
    expect(leaseSchema.safeParse({ ...valid, depositAmount: -1 }).success).toBe(
      false,
    );
  });
});
