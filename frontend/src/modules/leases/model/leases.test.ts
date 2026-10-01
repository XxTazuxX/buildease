import { describe, it, expect } from "vitest";
import {
  depositFormSchema,
  leaseEndFormSchema,
  leaseFormSchema,
  leaseSchema,
  paymentFormSchema,
  refundFormSchema,
} from "./leases";

describe("leaseFormSchema", () => {
  const valid = {
    residentId: "r",
    spaceId: "s",
    startsOn: "2026-02-01",
    endsOn: "",
    rentAmount: "1500",
    firstChargeOn: "2026-02-01",
    depositAmount: "",
  };
  const fails = (patch: object) =>
    !leaseFormSchema.safeParse({ ...valid, ...patch }).success;

  it("emits numbers and drops blank optional fields", () => {
    expect(leaseFormSchema.parse(valid)).toEqual({
      residentId: "r",
      spaceId: "s",
      startsOn: "2026-02-01",
      endsOn: undefined,
      rentAmount: 1500,
      firstChargeOn: "2026-02-01",
      depositAmount: undefined,
    });
  });
  it("applies the rent (0.01, 12.2) and deposit (0.00, 12.2) rules", () => {
    expect(fails({ rentAmount: "0" })).toBe(true);
    expect(fails({ rentAmount: "100.999" })).toBe(true);
    expect(fails({ rentAmount: "1234567890123" })).toBe(true);
    expect(fails({ depositAmount: "-1" })).toBe(true);
    expect(fails({ depositAmount: "0" })).toBe(false);
  });
  it("requires a resident, a space and both dates", () => {
    expect(fails({ residentId: "" })).toBe(true);
    expect(fails({ spaceId: "" })).toBe(true);
    expect(fails({ startsOn: "" })).toBe(true);
    expect(fails({ firstChargeOn: "" })).toBe(true);
  });
  it("rejects an end before the start and a first charge before the start", () => {
    const end = leaseFormSchema.safeParse({ ...valid, endsOn: "2026-01-31" });
    expect(!end.success && end.error.issues[0].path).toEqual(["endsOn"]);
    const first = leaseFormSchema.safeParse({
      ...valid,
      firstChargeOn: "2026-01-31",
    });
    expect(!first.success && first.error.issues[0].path).toEqual([
      "firstChargeOn",
    ]);
    expect(fails({ endsOn: "2026-02-01" })).toBe(false);
  });
});

describe("leaseEndFormSchema", () => {
  const schema = leaseEndFormSchema("2026-02-01");
  it("rejects an end date before the lease start and a missing reason", () => {
    expect(
      schema.safeParse({ endsOn: "2026-01-31", reason: "TERMINATED" }).success,
    ).toBe(false);
    expect(schema.safeParse({ endsOn: "2026-03-01", reason: "" }).success).toBe(
      false,
    );
    expect(
      schema.safeParse({ endsOn: "2026-02-01", reason: "EXPIRED" }).success,
    ).toBe(true);
  });
});

describe("payment, deposit and refund forms", () => {
  it("requires a positive payment with a method and received date", () => {
    const ok = { amount: "10", method: "CASH", receivedOn: "2026-02-01" };
    expect(paymentFormSchema.parse(ok).amount).toBe(10);
    expect(paymentFormSchema.safeParse({ ...ok, amount: "0" }).success).toBe(
      false,
    );
    expect(paymentFormSchema.safeParse({ ...ok, method: "" }).success).toBe(
      false,
    );
    expect(paymentFormSchema.safeParse({ ...ok, receivedOn: "" }).success).toBe(
      false,
    );
  });
  it("allows a zero deposit but not a negative one", () => {
    expect(
      depositFormSchema.safeParse({ amount: "0", heldOn: "2026-02-01" })
        .success,
    ).toBe(true);
    expect(
      depositFormSchema.safeParse({ amount: "-1", heldOn: "2026-02-01" })
        .success,
    ).toBe(false);
  });
  it("rejects a refund that is zero or exceeds the held deposit", () => {
    const schema = refundFormSchema(500);
    const refund = (refundedAmount: string) =>
      schema.safeParse({ refundedAmount, refundedOn: "2026-02-01" });
    expect(refund("0").success).toBe(false);
    const over = refund("500.01");
    expect(!over.success && over.error.issues[0].message).toBe(
      "Refund cannot exceed the held deposit",
    );
    expect(refund("500").success).toBe(true);
  });
});

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
