import { z } from "zod";
import { api, fetchAllPages } from "@/shared/api/client";
import {
  enumChoice,
  optionalDate,
  optionalText,
  requiredMoney,
  requiredText,
} from "@/shared/forms/rules";

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
  name: requiredText(160),
  category: enumChoice(assetCategories),
  manufacturer: optionalText(120).optional(),
  model: optionalText(120).optional(),
  serialNumber: optionalText(120).optional(),
  installDate: optionalDate().optional(),
  warrantyExpiresOn: optionalDate().optional(),
  notes: optionalText(2000).optional(),
});
export type NewAsset = z.infer<typeof assetSchema>;

export const meterReadingSchema = z.object({
  value: requiredMoney(),
  unit: requiredText(24),
});

const base = (org: string, building: string) =>
  `/organizations/${org}/buildings/${building}/assets`;
const assetBody = (body: NewAsset) => ({
  ...body,
  spaceId: body.spaceId || undefined,
  installDate: body.installDate || undefined,
  warrantyExpiresOn: body.warrantyExpiresOn || undefined,
});

export const assetsApi = {
  list: (org: string, building: string, status?: AssetStatus) =>
    fetchAllPages((page) =>
      api<AssetSummary[]>(
        `${base(org, building)}?page=${page}${status ? `&status=${status}` : ""}`,
      ),
    ),
  create: (org: string, building: string, body: NewAsset) =>
    api<{ id: string }>(base(org, building), "POST", assetBody(body)),
  update: (org: string, building: string, id: string, body: NewAsset) =>
    api(`${base(org, building)}/${id}`, "PATCH", assetBody(body)),
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
