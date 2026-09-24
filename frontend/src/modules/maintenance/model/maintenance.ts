import { z } from "zod";
import { api } from "@/shared/api/client";

export const impacts = ["LOW", "MEDIUM", "HIGH"] as const;
export const priorities = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export const requestStatuses = [
  "SUBMITTED",
  "TRIAGED",
  "ASSIGNED",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
  "CANCELLED",
] as const;
export type Impact = (typeof impacts)[number];
export type Priority = (typeof priorities)[number];
export type RequestStatus = (typeof requestStatuses)[number];
export interface MaintenanceCategory {
  id: string;
  name: string;
  default_priority: Priority;
  response_minutes: number;
  resolution_minutes: number;
  active: boolean;
}
export interface MaintenanceRequest {
  id: string;
  space_id: string;
  category_id: string;
  title: string;
  impact: Impact;
  danger: boolean;
  suggested_priority: Priority;
  priority: Priority | null;
  status: RequestStatus;
  response_due_at: string | null;
  resolution_due_at: string | null;
  created_at: string;
  updated_at: string;
}
export const requestSchema = z.object({
  spaceId: z.string().uuid(),
  categoryId: z.string().uuid(),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(4000),
  impact: z.enum(impacts),
  danger: z.boolean(),
});
export type NewMaintenanceRequest = z.infer<typeof requestSchema>;
export interface Comment {
  id: string;
  actor_id: string;
  body: string;
  internal: boolean;
  created_at: string;
}
export interface MaintenanceRequestDetail extends MaintenanceRequest {
  comments: Comment[];
}
const base = (org: string, building: string) =>
  `/organizations/${org}/buildings/${building}/maintenance`;
export const maintenanceApi = {
  categories: (org: string, building: string) =>
    api<MaintenanceCategory[]>(`${base(org, building)}/categories`),
  createCategory: (
    org: string,
    building: string,
    body: { name: string; responseHours: number; resolutionHours: number },
  ) => api(`${base(org, building)}/categories`, "POST", body),
  updateCategory: (
    org: string,
    building: string,
    category: string,
    body: { name: string; responseHours: number; resolutionHours: number },
  ) => api(`${base(org, building)}/categories/${category}`, "PATCH", body),
  requests: (org: string, building: string) =>
    api<MaintenanceRequest[]>(`${base(org, building)}/requests`),
  detail: (org: string, building: string, request: string) =>
    api<MaintenanceRequestDetail>(`${base(org, building)}/requests/${request}`),
  submit: (org: string, building: string, body: NewMaintenanceRequest) =>
    api<{ id: string }>(`${base(org, building)}/requests`, "POST", body),
  comment: (org: string, building: string, request: string, body: string) =>
    api<{ id: string }>(
      `${base(org, building)}/requests/${request}/comments`,
      "POST",
      {
        body,
        internal: false,
      },
    ),
  triage: (
    org: string,
    building: string,
    request: string,
    priority: Priority,
    reason: string,
  ) =>
    api(`${base(org, building)}/requests/${request}/triage`, "POST", {
      priority,
      reason,
    }),
  start: (org: string, building: string, request: string) =>
    api(`${base(org, building)}/requests/${request}/start`, "POST"),
  resolve: (org: string, building: string, request: string, summary: string) =>
    api(`${base(org, building)}/requests/${request}/resolve`, "POST", {
      summary,
    }),
  close: (
    org: string,
    building: string,
    request: string,
    outcome: "CONFIRMED" | "REJECTED",
  ) =>
    api(`${base(org, building)}/requests/${request}/close`, "POST", {
      outcome,
    }),
  preparePhoto: (org: string, building: string, request: string, photo: Blob) =>
    api<{ id: string; uploadUrl: string; contentType: string }>(
      `${base(org, building)}/requests/${request}/photos/upload`,
      "POST",
      { contentType: photo.type, sizeBytes: photo.size },
    ),
};
export async function stripPhotoMetadata(file: File) {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 10 * 1024 * 1024
  )
    throw new Error("Choose a JPEG, PNG, or WebP photo up to 10 MB");
  const bitmap = await createImageBitmap(file);
  if (bitmap.width > 6000 || bitmap.height > 6000) {
    bitmap.close();
    throw new Error("Photo dimensions are too large");
  }
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
  bitmap.close();
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("Photo could not be processed")),
      file.type,
      0.9,
    ),
  );
}
