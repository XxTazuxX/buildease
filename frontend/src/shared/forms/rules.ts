import { z } from "zod";

/**
 * Field rules that mirror the backend's Bean Validation annotations
 * (@NotBlank/@Size, @Email, @DecimalMin + @Digits, @Min/@Max, @Pattern) and
 * PasswordPolicy. They improve UX only; the backend stays authoritative.
 *
 * Text rules trim, and callers must send the validated (trimmed) output.
 * Numeric rules take the raw input string and emit numbers.
 */

const tooLong = (max: number) => `Use at most ${max} characters`;

export const requiredText = (max: number) =>
  z.string().trim().min(1, "Required").max(max, tooLong(max));

export const optionalText = (max: number) =>
  z.string().trim().max(max, tooLong(max));

export const requiredEmail = (max = 254) =>
  z
    .string()
    .trim()
    .min(1, "Required")
    .max(max, tooLong(max))
    .email("Enter a valid email address");

export const optionalEmail = (max = 254) =>
  z
    .string()
    .trim()
    .max(max, tooLong(max))
    .refine(
      (value) => value === "" || z.string().email().safeParse(value).success,
      "Enter a valid email address",
    );

export const requiredChoice = (message = "Select an option") =>
  z.string().min(1, message);

export const enumChoice = <const T extends readonly [string, ...string[]]>(
  values: T,
  message = "Select an option",
) => z.enum(values, { errorMap: () => ({ message }) });

export const pattern = (regexp: RegExp, message: string) =>
  z.string().trim().regex(regexp, message);

/** Blank reports "Required"; anything else must match (backend @NotBlank + @Pattern). */
export const requiredPattern = (regexp: RegExp, message: string) =>
  z.string().trim().min(1, "Required").regex(regexp, message);

/** Blank is allowed (the field is omitted); anything else must match. */
export const optionalPattern = (regexp: RegExp, message: string) =>
  z
    .string()
    .trim()
    .refine((value) => value === "" || regexp.test(value), message);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string) {
  if (!ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

export const requiredDate = (message = "Enter a valid date") =>
  z
    .string()
    .trim()
    .min(1, "Required")
    .refine(isIsoDate, message);

export const optionalDate = (message = "Enter a valid date") =>
  z
    .string()
    .trim()
    .refine((value) => value === "" || isIsoDate(value), message)
    .transform((value) => (value === "" ? undefined : value));

interface MoneyOptions {
  /** Inclusive lower bound; the backend uses 0.00 or 0.01. */
  min?: number;
  /** Max digits before the decimal point (@Digits integer); defaults to 12. */
  integerDigits?: number;
}

function checkMoney(
  raw: string,
  { min = 0, integerDigits = 12 }: MoneyOptions,
  ctx: z.RefinementCtx,
) {
  if (!/^\d+(\.\d+)?$/.test(raw)) {
    ctx.addIssue({ code: "custom", message: "Enter a valid amount" });
    return;
  }
  const [whole, fraction = ""] = raw.split(".");
  if (whole.replace(/^0+(?=\d)/, "").length > integerDigits) {
    ctx.addIssue({
      code: "custom",
      message: `Use at most ${integerDigits} digits before the decimal point`,
    });
    return;
  }
  if (fraction.length > 2) {
    ctx.addIssue({ code: "custom", message: "Use at most 2 decimal places" });
    return;
  }
  if (Number(raw) < min) {
    ctx.addIssue({ code: "custom", message: `Must be at least ${min}` });
  }
}

export const requiredMoney = (options: MoneyOptions = {}) =>
  z
    .string()
    .trim()
    .min(1, "Required")
    .superRefine((raw, ctx) => checkMoney(raw, options, ctx))
    .transform(Number);

export const optionalMoney = (options: MoneyOptions = {}) =>
  z
    .string()
    .trim()
    .superRefine((raw, ctx) => {
      if (raw !== "") checkMoney(raw, options, ctx);
    })
    .transform((raw) => (raw === "" ? undefined : Number(raw)));

interface IntegerOptions {
  min?: number;
  max?: number;
}

function checkInteger(
  raw: string,
  { min, max }: IntegerOptions,
  ctx: z.RefinementCtx,
) {
  if (!/^-?\d+$/.test(raw)) {
    ctx.addIssue({ code: "custom", message: "Enter a whole number" });
    return;
  }
  const value = Number(raw);
  if (min !== undefined && value < min) {
    ctx.addIssue({ code: "custom", message: `Must be at least ${min}` });
  } else if (max !== undefined && value > max) {
    ctx.addIssue({ code: "custom", message: `Must be at most ${max}` });
  }
}

export const requiredInteger = (options: IntegerOptions = {}) =>
  z
    .string()
    .trim()
    .min(1, "Required")
    .superRefine((raw, ctx) => checkInteger(raw, options, ctx))
    .transform(Number);

export const optionalInteger = (options: IntegerOptions = {}) =>
  z
    .string()
    .trim()
    .superRefine((raw, ctx) => {
      if (raw !== "") checkInteger(raw, options, ctx);
    })
    .transform((raw) => (raw === "" ? undefined : Number(raw)));

const PASSWORD_MESSAGE = "Use 15–64 characters, at most 72 UTF-8 bytes";

export function isValidPassword(value: string) {
  const length = [...value].length;
  return (
    length >= 15 &&
    length <= 64 &&
    new TextEncoder().encode(value).length <= 72
  );
}

/** Mirrors the backend PasswordPolicy. Never trimmed. */
export const passwordRule = (message = PASSWORD_MESSAGE) =>
  z.string().refine(isValidPassword, message);

/** A password that may be left blank, but must satisfy the policy if given. */
export const optionalPasswordRule = (message = PASSWORD_MESSAGE) =>
  z.string().refine((value) => value === "" || isValidPassword(value), message);

/** Adds an issue on `path` when `later` is a date before `earlier` (ISO dates). */
export function requireDateOrder(
  ctx: z.RefinementCtx,
  earlier: string | undefined,
  later: string | undefined,
  path: string,
  message: string,
) {
  if (earlier && later && later < earlier) {
    ctx.addIssue({ code: "custom", path: [path], message });
  }
}
