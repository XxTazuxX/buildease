import { describe, expect, it } from "vitest";
import {
  billingProfileSchema,
  invoiceFormSchema,
  limitLabel,
  money,
  newInvoiceSchema,
  planFormSchema,
  planSchema,
  subscriptionFormSchema,
} from "./billing";

describe("planFormSchema", () => {
  const form = {
    code: "GROWTH",
    name: "Growth",
    description: "",
    monthlyPrice: "99",
    annualPrice: "990.50",
    currency: "usd",
    maxBuildings: "",
    maxSpaces: "50",
    maxStaff: "",
    features: "Reports\n\n  Support  \n",
    trialDays: "14",
    publiclyListed: true,
    active: true,
    sortOrder: "2",
  };
  const fails = (patch: object) =>
    !planFormSchema.safeParse({ ...form, ...patch }).success;

  it("turns strings into the API shape: numbers, null limits, trimmed features", () => {
    expect(planFormSchema.parse(form)).toMatchObject({
      monthlyPrice: 99,
      annualPrice: 990.5,
      maxBuildings: null,
      maxSpaces: 50,
      maxStaff: null,
      features: ["Reports", "Support"],
      trialDays: 14,
      sortOrder: 2,
    });
  });
  it("survives the ViewModel's second parse with the API planSchema", () => {
    expect(() => planSchema.parse(planFormSchema.parse(form))).not.toThrow();
  });
  it("enforces the backend limits", () => {
    expect(fails({ code: "" })).toBe(true);
    expect(fails({ code: "a" })).toBe(true);
    expect(fails({ code: "has space" })).toBe(true);
    expect(fails({ code: "x".repeat(41) })).toBe(true);
    expect(fails({ name: "n".repeat(81) })).toBe(true);
    expect(fails({ description: "d".repeat(501) })).toBe(true);
    expect(fails({ monthlyPrice: "-1" })).toBe(true);
    expect(fails({ annualPrice: "1.999" })).toBe(true);
    expect(fails({ currency: "US" })).toBe(true);
    expect(fails({ maxBuildings: "-1" })).toBe(true);
    expect(fails({ maxStaff: "2.5" })).toBe(true);
    expect(fails({ trialDays: "91" })).toBe(true);
    expect(fails({ trialDays: "-1" })).toBe(true);
    expect(fails({ sortOrder: "" })).toBe(true);
    expect(fails({ features: Array(21).fill("f").join("\n") })).toBe(true);
    expect(fails({ features: "f".repeat(121) })).toBe(true);
  });
});

describe("subscriptionFormSchema", () => {
  const base = {
    planId: "p1",
    status: "ACTIVE",
    cycle: "MONTHLY",
    trialEndsOn: "",
    periodEnd: "",
  };
  it("requires a plan and, for trials, a trial end date", () => {
    expect(subscriptionFormSchema.safeParse(base).success).toBe(true);
    expect(
      subscriptionFormSchema.safeParse({ ...base, planId: "" }).success,
    ).toBe(false);
    const trial = subscriptionFormSchema.safeParse({
      ...base,
      status: "TRIALING",
    });
    expect(!trial.success && trial.error.issues[0].path).toEqual([
      "trialEndsOn",
    ]);
    expect(
      subscriptionFormSchema.safeParse({
        ...base,
        status: "TRIALING",
        trialEndsOn: "2026-12-01",
      }).success,
    ).toBe(true);
    expect(
      subscriptionFormSchema.safeParse({ ...base, periodEnd: "2026-02-30" })
        .success,
    ).toBe(false);
  });
});

describe("invoiceFormSchema", () => {
  const base = {
    organizationId: "o1",
    fromPlan: true,
    description: "",
    amount: "",
    tax: "",
    notes: "",
  };
  it("needs only an organization when billing the plan", () => {
    expect(invoiceFormSchema.safeParse(base).success).toBe(true);
    expect(
      invoiceFormSchema.safeParse({ ...base, organizationId: "" }).success,
    ).toBe(false);
  });
  it("requires a description and amount for custom invoices", () => {
    const result = invoiceFormSchema.safeParse({ ...base, fromPlan: false });
    expect(
      !result.success && result.error.issues.map((issue) => issue.path[0]),
    ).toEqual(["description", "amount"]);
    expect(
      invoiceFormSchema.parse({
        ...base,
        fromPlan: false,
        description: "Onboarding",
        amount: "250",
        tax: "12.5",
      }),
    ).toMatchObject({ amount: 250, tax: 12.5 });
  });
  it("limits description 300, notes 1000 and money to 12.2", () => {
    const custom = { ...base, fromPlan: false, description: "d", amount: "1" };
    const fails = (patch: object) =>
      !invoiceFormSchema.safeParse({ ...custom, ...patch }).success;
    expect(fails({ description: "d".repeat(301) })).toBe(true);
    expect(fails({ notes: "n".repeat(1001) })).toBe(true);
    expect(fails({ amount: "-1" })).toBe(true);
    expect(fails({ tax: "1.234" })).toBe(true);
  });
});

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
