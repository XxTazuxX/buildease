import { z } from "zod";
import { api } from "@/shared/api/client";
import {
  enumChoice,
  optionalInteger,
  optionalMoney,
  optionalPattern,
  optionalText,
  requiredPattern,
  requiredText,
} from "@/shared/forms/rules";

export const spaceTypes = [
  "FLAT",
  "ROOM",
  "SHOP",
  "OFFICE",
  "PARKING",
  "STORAGE",
  "COMMON_AREA",
  "OTHER",
] as const;
export const spaceStatuses = [
  "VACANT",
  "RESERVED",
  "MAINTENANCE",
  "INACTIVE",
] as const;
export type SpaceType = (typeof spaceTypes)[number];
export type SpaceStatus = (typeof spaceStatuses)[number] | "OCCUPIED";

export interface BuildingProfile {
  id: string;
  name: string;
  code: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  country_code: string | null;
  timezone: string;
  currency: string;
  emergency_contact: string | null;
  late_fee_amount: string | null;
  late_fee_grace_days: number;
}
export interface BuildingLevel {
  id: string;
  name: string;
  code: string;
  sort_order: number;
  active: boolean;
}
export interface Space {
  id: string;
  level_id: string | null;
  parent_space_id: string | null;
  name: string;
  code: string;
  type: SpaceType;
  status: SpaceStatus;
  rentable: boolean;
  area: number | null;
  capacity: number | null;
  notes: string | null;
}

export const configurationSchema = z.object({
  name: z.string().trim().min(1).max(120),
  addressLine1: z.string().trim().max(160),
  addressLine2: z.string().trim().max(160),
  city: z.string().trim().max(100),
  region: z.string().trim().max(100),
  postalCode: z.string().trim().max(24),
  countryCode: z
    .union([z.literal(""), z.string().trim().length(2)])
    .optional()
    .transform((value) => (value === "" ? undefined : value)),
  timezone: z.string().trim().min(1).max(64),
  currency: z.string().trim().length(3),
  emergencyContact: z.string().trim().max(160),
  lateFeeAmount: z.coerce.number().nonnegative().nullable(),
  lateFeeGraceDays: z.coerce.number().int().min(0).max(90),
});
export type BuildingConfiguration = z.infer<typeof configurationSchema>;

const CODE = /^[A-Za-z0-9_-]{1,40}$/;
const CODE_MESSAGE = "Use 1–40 letters, digits, hyphens or underscores";

export const configurationFormSchema = z.object({
  name: requiredText(120),
  addressLine1: optionalText(160),
  addressLine2: optionalText(160),
  city: optionalText(100),
  region: optionalText(100),
  postalCode: optionalText(24),
  countryCode: optionalPattern(
    /^[A-Za-z]{2}$/,
    "Use a 2-letter country code",
  ).transform((value) => (value === "" ? undefined : value)),
  timezone: requiredText(64),
  currency: requiredPattern(/^[A-Za-z]{3}$/, "Use a 3-letter currency code"),
  emergencyContact: optionalText(160),
  lateFeeAmount: optionalMoney().transform((value) => value ?? null),
  lateFeeGraceDays: optionalInteger({ min: 0, max: 90 }).transform(
    (value) => value ?? 0,
  ),
});

export const levelFormSchema = z.object({
  name: requiredText(120),
  code: requiredPattern(CODE, CODE_MESSAGE),
  sortOrder: optionalInteger({ min: -1000, max: 1000 }).transform(
    (value) => value ?? 0,
  ),
});

export const spaceFormSchema = z.object({
  name: requiredText(120),
  code: requiredPattern(CODE, CODE_MESSAGE),
  type: enumChoice(spaceTypes),
  levelId: z.string().transform((value) => value || null),
  parentSpaceId: z.string().transform((value) => value || null),
  rentable: z.boolean(),
  area: optionalMoney({ min: 0.01, integerDigits: 10 }).transform(
    (value) => value ?? null,
  ),
  capacity: optionalInteger({ min: 1, max: 100000 }).transform(
    (value) => value ?? null,
  ),
  notes: optionalText(1000),
});

export const buildingsApi = {
  profile: (org: string, building: string) =>
    api<BuildingProfile>(`/organizations/${org}/buildings/${building}`),
  configure: (org: string, building: string, body: BuildingConfiguration) =>
    api(`/organizations/${org}/buildings/${building}`, "PUT", body),
  levels: (org: string, building: string) =>
    api<BuildingLevel[]>(`/organizations/${org}/buildings/${building}/levels`),
  createLevel: (
    org: string,
    building: string,
    body: { name: string; code: string; sortOrder: number },
  ) => api(`/organizations/${org}/buildings/${building}/levels`, "POST", body),
  spaces: (org: string, building: string) =>
    api<Space[]>(`/organizations/${org}/buildings/${building}/spaces`),
  createSpace: (org: string, building: string, body: unknown) =>
    api(`/organizations/${org}/buildings/${building}/spaces`, "POST", body),
  setStatus: (
    org: string,
    building: string,
    space: string,
    status: Exclude<SpaceStatus, "OCCUPIED">,
  ) =>
    api(
      `/organizations/${org}/buildings/${building}/spaces/${space}/status`,
      "POST",
      { status },
    ),
};
