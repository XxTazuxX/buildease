import { describe, it, expect } from "vitest";
import { configurationSchema } from "./buildings";

describe("configurationSchema late fee fields", () => {
  const valid = {
    name: "Harbor House",
    addressLine1: "",
    addressLine2: "",
    city: "",
    region: "",
    postalCode: "",
    countryCode: "",
    timezone: "UTC",
    currency: "USD",
    emergencyContact: "",
    lateFeeAmount: null,
    lateFeeGraceDays: 5,
  };
  it("accepts a null late fee amount, meaning late fees are disabled", () => {
    expect(configurationSchema.safeParse(valid).success).toBe(true);
  });
  it("accepts a configured non-negative late fee amount", () => {
    expect(
      configurationSchema.safeParse({ ...valid, lateFeeAmount: 50 }).success,
    ).toBe(true);
  });
  it("rejects a negative late fee amount", () => {
    expect(
      configurationSchema.safeParse({ ...valid, lateFeeAmount: -1 }).success,
    ).toBe(false);
  });
  it("rejects a grace period outside 0-90 days", () => {
    expect(
      configurationSchema.safeParse({ ...valid, lateFeeGraceDays: -1 }).success,
    ).toBe(false);
    expect(
      configurationSchema.safeParse({ ...valid, lateFeeGraceDays: 91 }).success,
    ).toBe(false);
  });
});
