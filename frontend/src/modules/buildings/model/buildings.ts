import { z } from "zod";
import { api } from "@/shared/api/client";

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
  countryCode: z.union([z.literal(""), z.string().trim().length(2)]),
  timezone: z.string().trim().min(1).max(64),
  currency: z.string().trim().length(3),
  emergencyContact: z.string().trim().max(160),
});
export type BuildingConfiguration = z.infer<typeof configurationSchema>;

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
