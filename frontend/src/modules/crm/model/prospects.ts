import { z } from "zod";
import { api, fetchAllPages } from "@/shared/api/client";
import type { Lease } from "@/modules/leases";
import {
  optionalEmail,
  optionalText,
  requiredChoice,
  requiredText,
} from "@/shared/forms/rules";

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
  spaceId: z.string().uuid("Select a space"),
  name: requiredText(160),
  email: optionalEmail(254).optional(),
  phone: optionalText(40).optional(),
  notes: optionalText(2000).optional(),
});
export type NewProspect = z.infer<typeof newProspectSchema>;

/** The space a prospect is interested in is fixed once created. */
export const updateProspectSchema = newProspectSchema.omit({ spaceId: true });
export type UpdatedProspect = z.infer<typeof updateProspectSchema>;

export const linkLeaseSchema = z.object({
  leaseId: requiredChoice("Select a lease"),
});

/** Leases a prospect may be linked to: same space, draft or active, not taken. */
export function linkableLeases(
  leases: Lease[],
  prospect: Pick<ProspectSummary, "id" | "space_id">,
  prospects: Pick<ProspectSummary, "id" | "lease_id">[],
) {
  const taken = new Set(
    prospects
      .filter((other) => other.id !== prospect.id && other.lease_id)
      .map((other) => other.lease_id),
  );
  return leases.filter(
    (lease) =>
      ["DRAFT", "ACTIVE"].includes(lease.status) &&
      lease.space_id === prospect.space_id &&
      !taken.has(lease.id),
  );
}

const base = (org: string, building: string) =>
  `/organizations/${org}/buildings/${building}/prospects`;

export const prospectsApi = {
  list: (org: string, building: string, status?: ProspectStatus) =>
    fetchAllPages((page) =>
      api<ProspectSummary[]>(
        `${base(org, building)}?page=${page}${status ? `&status=${status}` : ""}`,
      ),
    ),
  create: (org: string, building: string, body: NewProspect) =>
    api<{ id: string }>(base(org, building), "POST", {
      ...body,
      email: body.email || undefined,
    }),
  detail: (org: string, building: string, id: string) =>
    api<ProspectDetail>(`${base(org, building)}/${id}`),
  update: (org: string, building: string, id: string, body: UpdatedProspect) =>
    api(`${base(org, building)}/${id}`, "PATCH", body),
  remove: (org: string, building: string, id: string) =>
    api(`${base(org, building)}/${id}`, "DELETE"),
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
