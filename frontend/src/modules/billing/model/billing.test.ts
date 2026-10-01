import { describe, expect, it } from "vitest";
import {
  billingProfileSchema,
  limitLabel,
  money,
  newInvoiceSchema,
  planSchema,
} from "./billing";

describe("billing model", () => {
  it("formats money with the currency", () => {
    expect(money(149, "USD")).toContain("149");
    expect(money("12.5", "XYZ-invalid")).toBe("12.50 XYZ-invalid");
  });

  it("labels limits, treating null as unlimited", () => {
    expect(limitLabel(null, "building")).toBe("Unlimited buildings");
    expect(limitLabel(1, "building")).toBe("1 building");
    expect(limitLabel(10, "unit")).toBe("10 units");
  });

  it("accepts a blank billing email but rejects an invalid one", () => {
    const profile = {
      billingEmail: "",
      billingName: "Acme",
      billingAddress: "",
      taxId: "",
    };
    expect(billingProfileSchema.safeParse(profile).success).toBe(true);
    expect(
      billingProfileSchema.safeParse({ ...profile, billingEmail: "nope" })
        .success,
    ).toBe(false);
  });

  it("normalizes blank plan limits to unlimited", () => {
    const parsed = planSchema.parse({
      code: "GROWTH",
      name: "Growth",
      description: "",
      monthlyPrice: 99,
      annualPrice: 990,
      currency: "USD",
      maxBuildings: null,
      maxSpaces: Number.NaN,
      maxStaff: 10,
      features: ["Reports"],
      trialDays: 0,
      publiclyListed: true,
      active: true,
      sortOrder: 2,
    });
    expect(parsed.maxBuildings).toBeNull();
    expect(parsed.maxSpaces).toBeNull();
    expect(parsed.maxStaff).toBe(10);
  });

  it("requires a description and amount only for custom invoices", () => {
    const base = {
      organizationId: "11111111-1111-1111-1111-111111111111",
      fromPlan: true,
      description: "",
      notes: "",
    };
    expect(newInvoiceSchema.safeParse(base).success).toBe(true);
    expect(
      newInvoiceSchema.safeParse({ ...base, fromPlan: false }).success,
    ).toBe(false);
    expect(
      newInvoiceSchema.safeParse({
        ...base,
        fromPlan: false,
        description: "Onboarding",
        amount: 250,
      }).success,
    ).toBe(true);
  });
});
