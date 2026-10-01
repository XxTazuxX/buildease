import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  enumChoice,
  isIsoDate,
  isValidPassword,
  optionalDate,
  optionalEmail,
  optionalInteger,
  optionalMoney,
  optionalPasswordRule,
  pattern,
  requiredDate,
  requiredEmail,
  requiredInteger,
  requiredMoney,
  requiredText,
  requireDateOrder,
} from "./rules";

const message = (schema: z.ZodTypeAny, value: unknown) => {
  const result = schema.safeParse(value);
  return result.success ? null : result.error.issues[0].message;
};

describe("text rules", () => {
  it("requires non-blank text within the limit and trims output", () => {
    const rule = requiredText(5);
    expect(message(rule, "   ")).toBe("Required");
    expect(message(rule, "abcdef")).toBe("Use at most 5 characters");
    expect(rule.parse("  abc ")).toBe("abc");
  });

  it("validates email format, length and optionality", () => {
    expect(message(requiredEmail(), "")).toBe("Required");
    expect(message(requiredEmail(), "nope")).toBe(
      "Enter a valid email address",
    );
    expect(message(requiredEmail(20), "someone@example.com.au")).toBe(
      "Use at most 20 characters",
    );
    expect(requiredEmail().parse(" a@b.co ")).toBe("a@b.co");
    expect(optionalEmail().parse("")).toBe("");
    expect(message(optionalEmail(), "bad")).toBe("Enter a valid email address");
  });

  it("enforces patterns and enum choices", () => {
    const code = pattern(/^[A-Za-z0-9_-]{1,40}$/, "bad code");
    expect(message(code, "has space")).toBe("bad code");
    expect(code.parse("A-1_b")).toBe("A-1_b");
    const choice = enumChoice(["A", "B"] as const);
    expect(message(choice, "")).toBe("Select an option");
    expect(choice.parse("A")).toBe("A");
  });
});

describe("date rules", () => {
  it("accepts only real ISO calendar dates", () => {
    expect(isIsoDate("2026-02-28")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("28/02/2026")).toBe(false);
    expect(message(requiredDate(), "")).toBe("Required");
    expect(message(requiredDate(), "2026-13-01")).toBe("Enter a valid date");
    expect(optionalDate().parse("")).toBeUndefined();
    expect(optionalDate().parse("2026-01-02")).toBe("2026-01-02");
    expect(message(optionalDate(), "x")).toBe("Enter a valid date");
  });

  it("adds an issue only when the later date precedes the earlier one", () => {
    const schema = z
      .object({ start: z.string(), end: z.string() })
      .superRefine((v, ctx) =>
        requireDateOrder(ctx, v.start, v.end, "end", "End before start"),
      );
    expect(
      schema.safeParse({ start: "2026-01-02", end: "2026-01-01" }).success,
    ).toBe(false);
    expect(
      schema.safeParse({ start: "2026-01-02", end: "2026-01-02" }).success,
    ).toBe(true);
    expect(schema.safeParse({ start: "2026-01-02", end: "" }).success).toBe(
      true,
    );
  });
});

describe("money rules (DecimalMin + Digits(12,2))", () => {
  it("applies the minimum, decimals and integer digit limits", () => {
    const rent = requiredMoney({ min: 0.01 });
    expect(message(rent, "")).toBe("Required");
    expect(message(rent, "abc")).toBe("Enter a valid amount");
    expect(message(rent, "-5")).toBe("Enter a valid amount");
    expect(message(rent, "1e3")).toBe("Enter a valid amount");
    expect(message(rent, "0")).toBe("Must be at least 0.01");
    expect(message(rent, "10.123")).toBe("Use at most 2 decimal places");
    expect(message(rent, "1234567890123")).toBe(
      "Use at most 12 digits before the decimal point",
    );
    expect(rent.parse("1200.50")).toBe(1200.5);
    expect(rent.parse("999999999999.99")).toBe(999999999999.99);
  });

  it("allows zero by default and blanks for optional money", () => {
    expect(requiredMoney().parse("0")).toBe(0);
    expect(optionalMoney().parse("")).toBeUndefined();
    expect(optionalMoney().parse("3.5")).toBe(3.5);
    expect(message(optionalMoney({ min: 0.01 }), "0")).toBe(
      "Must be at least 0.01",
    );
  });
});

describe("integer rules (Min/Max)", () => {
  it("applies bounds and whole-number checks", () => {
    const days = requiredInteger({ min: 0, max: 90 });
    expect(message(days, "")).toBe("Required");
    expect(message(days, "1.5")).toBe("Enter a whole number");
    expect(message(days, "-1")).toBe("Must be at least 0");
    expect(message(days, "91")).toBe("Must be at most 90");
    expect(days.parse("30")).toBe(30);
    expect(optionalInteger({ min: 1 }).parse("")).toBeUndefined();
    expect(message(optionalInteger({ min: 1 }), "0")).toBe(
      "Must be at least 1",
    );
  });
});

describe("password policy", () => {
  it("counts code points and UTF-8 bytes like the backend", () => {
    expect(isValidPassword("a".repeat(14))).toBe(false);
    expect(isValidPassword("a".repeat(15))).toBe(true);
    expect(isValidPassword("a".repeat(65))).toBe(false);
    expect(isValidPassword("é".repeat(37))).toBe(false);
    expect(isValidPassword("😀".repeat(18))).toBe(true);
    expect(isValidPassword("😀".repeat(19))).toBe(false);
  });

  it("allows a blank only for the optional rule", () => {
    expect(optionalPasswordRule().safeParse("").success).toBe(true);
    expect(optionalPasswordRule().safeParse("short").success).toBe(false);
  });
});
