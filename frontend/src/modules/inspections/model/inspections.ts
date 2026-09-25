import { z } from "zod";
import { api } from "@/shared/api/client";

export const inspectionTypes = ["MOVE_IN", "MOVE_OUT", "ROUTINE"] as const;
export type InspectionType = (typeof inspectionTypes)[number];
export const conditions = ["GOOD", "FAIR", "DAMAGED"] as const;
export type Condition = (typeof conditions)[number];

export interface InspectionSummary {
  id: string;
  space_id: string;
  lease_id: string | null;
  resident_id: string | null;
  type: InspectionType;
  status: "DRAFT" | "COMPLETED";
  scheduled_on: string;
  completed_at: string | null;
  resident_acknowledged_at: string | null;
}
export interface InspectionItem {
  id: string;
  area: string;
  condition: Condition;
  notes: string | null;
}
export interface InspectionPhoto {
  id: string;
  uploaded_by: string;
  content_type: string;
  size_bytes: number;
  created_at: string;
}
export interface InspectionDetail extends InspectionSummary {
  conducted_by: string | null;
  notes: string | null;
  items: InspectionItem[];
  photos: InspectionPhoto[];
}

export const createInspectionSchema = z.object({
  spaceId: z.string().uuid(),
  leaseId: z.union([z.literal(""), z.string().uuid()]).optional(),
  residentId: z.union([z.literal(""), z.string().uuid()]).optional(),
  type: z.enum(inspectionTypes),
  scheduledOn: z.string().min(1),
});
export type NewInspection = z.infer<typeof createInspectionSchema>;

export const itemSchema = z.object({
  area: z.string().trim().min(1).max(120),
  condition: z.enum(conditions),
  notes: z.string().trim().max(500).optional(),
});
export type NewItem = z.infer<typeof itemSchema>;

const base = (org: string, building: string) =>
  `/organizations/${org}/buildings/${building}/inspections`;

export const inspectionsApi = {
  list: (org: string, building: string, page: number, spaceId?: string) =>
    api<InspectionSummary[]>(
      `${base(org, building)}?page=${page}${spaceId ? `&spaceId=${spaceId}` : ""}`,
    ),
  create: (org: string, building: string, body: NewInspection) =>
    api<{ id: string }>(base(org, building), "POST", {
      ...body,
      leaseId: body.leaseId || undefined,
      residentId: body.residentId || undefined,
    }),
  detail: (org: string, building: string, id: string) =>
    api<InspectionDetail>(`${base(org, building)}/${id}`),
  addItem: (org: string, building: string, id: string, body: NewItem) =>
    api<{ id: string }>(`${base(org, building)}/${id}/items`, "POST", body),
  complete: (org: string, building: string, id: string, notes?: string) =>
    api(
      `${base(org, building)}/${id}/complete`,
      "POST",
      notes ? { notes } : {},
    ),
  acknowledge: (org: string, building: string, id: string) =>
    api(`${base(org, building)}/${id}/acknowledge`, "POST"),
  preparePhoto: (org: string, building: string, id: string, photo: Blob) =>
    api<{ id: string; uploadUrl: string; contentType: string }>(
      `${base(org, building)}/${id}/photos/upload`,
      "POST",
      { contentType: photo.type, sizeBytes: photo.size },
    ),
};
