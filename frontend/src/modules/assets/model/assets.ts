import { z } from "zod";
import { api } from "@/shared/api/client";

export const assetCategories = [
  "HVAC",
  "APPLIANCE",
  "PLUMBING",
  "ELECTRICAL",
  "ELEVATOR",
  "FIRE_SAFETY",
  "SECURITY",
  "STRUCTURAL",
  "OTHER",
] as const;
export type AssetCategory = (typeof assetCategories)[number];
export const assetStatuses = ["ACTIVE", "RETIRED"] as const;
export type AssetStatus = (typeof assetStatuses)[number];

export interface AssetSummary {
  id: string;
  space_id: string | null;
  name: string;
  category: AssetCategory;
  manufacturer: string | null;
  model: string | null;
  warranty_expires_on: string | null;
  status: AssetStatus;
}
export interface MeterReading {
  id: string;
  reading_value: string;
  unit: string;
  recorded_by: string;
  recorded_at: string;
}
export interface AssetDetail {
  id: string;
  space_id: string | null;
  name: string;
  category: AssetCategory;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  install_date: string | null;
  warranty_expires_on: string | null;
  status: AssetStatus;
  notes: string | null;
  meterReadings: MeterReading[];
}

export const assetSchema = z.object({
  spaceId: z.union([z.literal(""), z.string().uuid()]).optional(),
  name: z.string().trim().min(1).max(160),
  category: z.enum(assetCategories),
  manufacturer: z.string().trim().max(120).optional(),
  model: z.string().trim().max(120).optional(),
  serialNumber: z.string().trim().max(120).optional(),
  installDate: z.string().optional(),
  warrantyExpiresOn: z.string().optional(),
  notes: z.string().trim().max(2000).optional(),
});
export type NewAsset = z.infer<typeof assetSchema>;

const base = (org: string, building: string) =>
  `/organizations/${org}/buildings/${building}/assets`;

export const assetsApi = {
  list: (org: string, building: string, status?: AssetStatus) =>
    api<AssetSummary[]>(
      `${base(org, building)}${status ? `?status=${status}` : ""}`,
    ),
  create: (org: string, building: string, body: NewAsset) =>
    api<{ id: string }>(base(org, building), "POST", {
      ...body,
      spaceId: body.spaceId || undefined,
      installDate: body.installDate || undefined,
      warrantyExpiresOn: body.warrantyExpiresOn || undefined,
    }),
  detail: (org: string, building: string, id: string) =>
    api<AssetDetail>(`${base(org, building)}/${id}`),
  setStatus: (org: string, building: string, id: string, status: AssetStatus) =>
    api(`${base(org, building)}/${id}/status`, "POST", { status }),
  recordMeterReading: (
    org: string,
    building: string,
    id: string,
    value: number,
    unit: string,
  ) =>
    api<{ id: string }>(`${base(org, building)}/${id}/meter-readings`, "POST", {
      value,
      unit,
    }),
};
