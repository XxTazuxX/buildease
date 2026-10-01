import { describe, it, expect } from "vitest";
import {
  configurationFormSchema,
  configurationSchema,
  levelFormSchema,
  spaceFormSchema,
} from "./buildings";

describe("configurationFormSchema", () => {
  const form = {
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
    lateFeeAmount: "",
    lateFeeGraceDays: "5",
  };

  it("omits a blank country code and disables late fees with a blank amount", () => {
    const parsed = configurationFormSchema.parse(form);
    expect(parsed.countryCode).toBeUndefined();
    expect(parsed.lateFeeAmount).toBeNull();
    expect(parsed.lateFeeGraceDays).toBe(5);
  });

  it("survives the ViewModel's second parse with the API schema", () => {
    expect(() =>
      configurationSchema.parse(configurationFormSchema.parse(form)),
    ).not.toThrow();
    expect(() =>
      configurationSchema.parse(
        configurationFormSchema.parse({
          ...form,
          countryCode: "us",
          lateFeeAmount: "12.50",
        }),
      ),
    ).not.toThrow();
  });

  it("enforces the backend limits and patterns", () => {
    const fails = (patch: object) =>
      !configurationFormSchema.safeParse({ ...form, ...patch }).success;
    expect(fails({ name: "" })).toBe(true);
    expect(fails({ name: "n".repeat(121) })).toBe(true);
    expect(fails({ addressLine1: "a".repeat(161) })).toBe(true);
    expect(fails({ city: "c".repeat(101) })).toBe(true);
    expect(fails({ postalCode: "p".repeat(25) })).toBe(true);
    expect(fails({ countryCode: "USA" })).toBe(true);
    expect(fails({ countryCode: "U1" })).toBe(true);
    expect(fails({ timezone: "" })).toBe(true);
    expect(fails({ timezone: "z".repeat(65) })).toBe(true);
    expect(fails({ currency: "" })).toBe(true);
    expect(fails({ currency: "US" })).toBe(true);
    expect(fails({ emergencyContact: "e".repeat(161) })).toBe(true);
    expect(fails({ lateFeeAmount: "-1" })).toBe(true);
    expect(fails({ lateFeeAmount: "1.234" })).toBe(true);
    expect(fails({ lateFeeGraceDays: "91" })).toBe(true);
    expect(fails({ lateFeeGraceDays: "-1" })).toBe(true);
  });
});

describe("levelFormSchema", () => {
  it("requires a name and a code matching [A-Za-z0-9_-]{1,40}", () => {
    expect(
      levelFormSchema.parse({ name: "L1", code: "L-1", sortOrder: "" }),
    ).toMatchObject({ sortOrder: 0 });
    for (const code of ["", "has space", "x".repeat(41)])
      expect(
        levelFormSchema.safeParse({ name: "L1", code, sortOrder: "0" }).success,
      ).toBe(false);
    expect(
      levelFormSchema.safeParse({ name: "", code: "a", sortOrder: "0" })
        .success,
    ).toBe(false);
  });
  it("limits the display order to -1000..1000", () => {
    for (const sortOrder of ["-1001", "1001", "1.5"])
      expect(
        levelFormSchema.safeParse({ name: "L1", code: "a", sortOrder }).success,
      ).toBe(false);
  });
});

describe("spaceFormSchema", () => {
  const space = {
    name: "Flat 1",
    code: "F1",
    type: "FLAT",
    levelId: "",
    parentSpaceId: "",
    rentable: true,
    area: "",
    capacity: "",
    notes: "",
  };
  it("turns blank optional fields into nulls", () => {
    expect(spaceFormSchema.parse(space)).toMatchObject({
      levelId: null,
      parentSpaceId: null,
      area: null,
      capacity: null,
    });
  });
  it("applies the area (0.01, 10.2 digits), capacity (1-100000) and notes limits", () => {
    const fails = (patch: object) =>
      !spaceFormSchema.safeParse({ ...space, ...patch }).success;
    expect(fails({ area: "0" })).toBe(true);
    expect(fails({ area: "12345678901" })).toBe(true);
    expect(fails({ area: "1.234" })).toBe(true);
    expect(fails({ capacity: "0" })).toBe(true);
    expect(fails({ capacity: "100001" })).toBe(true);
    expect(fails({ notes: "n".repeat(1001) })).toBe(true);
    expect(fails({ type: "" })).toBe(true);
    expect(fails({ area: "55.5", capacity: "4" })).toBe(false);
  });
});

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
