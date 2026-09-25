import { z } from "zod";
import { api } from "@/shared/api/client";

export const prospectStatuses = [
  "NEW",
  "CONTACTED",
  "APPLIED",
  "SCREENING",
  "APPROVED",
  "REJECTED",
  "LEASED",
  "WITHDRAWN",
] as const;
export type ProspectStatus = (typeof prospectStatuses)[number];

export interface ProspectSummary {
  id: string;
  space_id: string;
  listing_id: string | null;
  lease_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  status: ProspectStatus;
  created_at: string;
}
export interface ProspectDetail extends ProspectSummary {
  notes: string | null;
  updated_at: string;
}

export const newProspectSchema = z.object({
  spaceId: z.string().uuid(),
  name: z.string().trim().min(1).max(160),
  email: z.union([z.literal(""), z.string().trim().email()]).optional(),
  phone: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(2000).optional(),
});
export type NewProspect = z.infer<typeof newProspectSchema>;

const base = (org: string, building: string) =>
  `/organizations/${org}/buildings/${building}/prospects`;

export const prospectsApi = {
  list: (org: string, building: string, status?: ProspectStatus) =>
    api<ProspectSummary[]>(
      `${base(org, building)}${status ? `?status=${status}` : ""}`,
    ),
  create: (org: string, building: string, body: NewProspect) =>
    api<{ id: string }>(base(org, building), "POST", {
      ...body,
      email: body.email || undefined,
    }),
  detail: (org: string, building: string, id: string) =>
    api<ProspectDetail>(`${base(org, building)}/${id}`),
  updateStatus: (
    org: string,
    building: string,
    id: string,
    status: ProspectStatus,
    notes?: string,
  ) => api(`${base(org, building)}/${id}/status`, "POST", { status, notes }),
  linkLease: (org: string, building: string, id: string, leaseId: string) =>
    api(`${base(org, building)}/${id}/link-lease`, "POST", { leaseId }),
};
