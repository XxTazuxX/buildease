import { z } from "zod";
import { api } from "@/shared/api/client";
import {
  enumChoice,
  optionalEmail,
  optionalInteger,
  optionalMoney,
  optionalText,
  optionalUuid,
  requiredChoice,
  requiredDate,
  requiredInteger,
  requiredMoney,
  requiredText,
} from "@/shared/forms/rules";

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
  spaceId: z.string().uuid("Select a space"),
  categoryId: z.string().uuid("Select a category"),
  title: requiredText(160),
  description: requiredText(4000),
  impact: enumChoice(impacts),
  danger: z.boolean(),
});
export type NewMaintenanceRequest = z.infer<typeof requestSchema>;

export const categoryFormSchema = z
  .object({
    name: requiredText(120),
    responseHours: requiredInteger({ min: 1, max: 8760 }),
    resolutionHours: requiredInteger({ min: 1, max: 87600 }),
  })
  .superRefine((category, ctx) => {
    if (category.resolutionHours < category.responseHours)
      ctx.addIssue({
        code: "custom",
        path: ["resolutionHours"],
        message: "Resolution target must not precede the response target",
      });
  });

export const resolutionFormSchema = z.object({ summary: requiredText(2000) });
export const reasonFormSchema = z.object({ reason: requiredText(500) });

export const assignmentFormSchema = z
  .object({
    target: z.enum(["vendor", "staff"]),
    vendorId: z.string(),
    accountId: z.string(),
    estimate: optionalMoney(),
  })
  .superRefine((assignment, ctx) => {
    if (assignment.target === "vendor" && !assignment.vendorId)
      ctx.addIssue({
        code: "custom",
        path: ["vendorId"],
        message: "Select a vendor",
      });
    if (assignment.target === "staff" && !assignment.accountId)
      ctx.addIssue({
        code: "custom",
        path: ["accountId"],
        message: "Select a staff member",
      });
  });

export const vendorFormSchema = z.object({
  name: requiredText(160),
  email: optionalEmail(254),
  phone: optionalText(40),
  accountId: optionalUuid("Enter a valid account ID"),
});

export const commentFormSchema = z.object({
  body: requiredText(2000),
  internal: z.boolean(),
});
export const workLogFormSchema = z.object({
  note: requiredText(2000),
  minutes: optionalInteger({ min: 1, max: 1440 }),
});
export const workCostFormSchema = z.object({ actualCost: requiredMoney() });
export interface Comment {
  id: string;
  actor_id: string;
  body: string;
  internal: boolean;
  created_at: string;
}
export interface HistoryEntry {
  actor_id: string;
  from_status: RequestStatus | null;
  to_status: RequestStatus;
  reason: string | null;
  created_at: string;
}
export const workOrderStatuses = [
  "ASSIGNED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;
export type WorkOrderStatus = (typeof workOrderStatuses)[number];
export interface WorkOrder {
  id: string;
  assigned_account_id: string | null;
  vendor_id: string | null;
  status: WorkOrderStatus;
  estimated_cost: string | null;
  actual_cost: string | null;
  currency: string;
  created_at: string;
  updated_at: string;
}
export interface WorkLog {
  id: string;
  work_order_id: string;
  actor_id: string;
  note: string;
  minutes: number | null;
  created_at: string;
}
export interface Photo {
  id: string;
  content_type: string;
  size_bytes: number;
  created_at: string;
}
export interface Vendor {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  active: boolean;
  account_id?: string | null;
}
export interface MaintenanceRequestDetail extends MaintenanceRequest {
  description: string;
  created_by: string;
  resolution_summary: string | null;
  comments: Comment[];
  history: HistoryEntry[];
  work_orders: WorkOrder[];
  work_logs: WorkLog[];
  photos: Photo[];
}
export interface RecurringPlan {
  id: string;
  space_id: string;
  category_id: string;
  title: string;
  description: string;
  interval_days: number;
  next_run_on: string;
  active: boolean;
}
export const recurringPlanSchema = z.object({
  spaceId: z.string().uuid(),
  categoryId: z.string().uuid(),
  title: requiredText(160),
  description: requiredText(2000),
  intervalDays: z.number().int().min(1).max(3650),
  nextRunOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type NewRecurringPlan = z.infer<typeof recurringPlanSchema>;

export const recurringPlanFormSchema = z.object({
  spaceId: requiredChoice("Select a space"),
  categoryId: requiredChoice("Select a category"),
  title: requiredText(160),
  description: requiredText(2000),
  intervalDays: requiredInteger({ min: 1, max: 3650 }),
  nextRunOn: requiredDate(),
});
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
  deleteCategory: (org: string, building: string, category: string) =>
    api(`${base(org, building)}/categories/${category}`, "DELETE"),
  requests: (org: string, building: string, page = 0) =>
    api<MaintenanceRequest[]>(`${base(org, building)}/requests?page=${page}`),
  cancel: (org: string, building: string, request: string, reason: string) =>
    api(`${base(org, building)}/requests/${request}/cancel`, "POST", {
      reason,
    }),
  recurringPlans: (org: string, building: string) =>
    api<RecurringPlan[]>(`${base(org, building)}/recurring-plans`),
  createRecurringPlan: (
    org: string,
    building: string,
    body: NewRecurringPlan,
  ) =>
    api<{ id: string }>(`${base(org, building)}/recurring-plans`, "POST", body),
  updateRecurringPlan: (
    org: string,
    building: string,
    plan: string,
    body: NewRecurringPlan,
  ) => api(`${base(org, building)}/recurring-plans/${plan}`, "PATCH", body),
  deleteRecurringPlan: (org: string, building: string, plan: string) =>
    api(`${base(org, building)}/recurring-plans/${plan}`, "DELETE"),
  detail: (org: string, building: string, request: string) =>
    api<MaintenanceRequestDetail>(`${base(org, building)}/requests/${request}`),
  submit: (org: string, building: string, body: NewMaintenanceRequest) =>
    api<{ id: string }>(`${base(org, building)}/requests`, "POST", body),
  comment: (
    org: string,
    building: string,
    request: string,
    body: string,
    internal = false,
  ) =>
    api<{ id: string }>(
      `${base(org, building)}/requests/${request}/comments`,
      "POST",
      { body, internal },
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
  downloadPhoto: (
    org: string,
    building: string,
    request: string,
    photo: string,
  ) =>
    api<{ url: string }>(
      `${base(org, building)}/requests/${request}/photos/${photo}/download`,
    ),
  vendors: (org: string, building: string) =>
    api<Vendor[]>(`${base(org, building)}/vendors`),
  createVendor: (
    org: string,
    building: string,
    body: { name: string; email?: string; phone?: string; accountId?: string },
  ) => api<{ id: string }>(`${base(org, building)}/vendors`, "POST", body),
  updateVendor: (
    org: string,
    building: string,
    vendor: string,
    body: { name: string; email?: string; phone?: string; accountId?: string },
  ) => api(`${base(org, building)}/vendors/${vendor}`, "PATCH", body),
  deleteVendor: (org: string, building: string, vendor: string) =>
    api(`${base(org, building)}/vendors/${vendor}`, "DELETE"),
  assignStaff: (
    org: string,
    building: string,
    request: string,
    accountId: string,
    estimatedCost?: number,
  ) =>
    api<{ id: string }>(
      `${base(org, building)}/requests/${request}/assign-staff`,
      "POST",
      { accountId, estimatedCost },
    ),
  assignVendor: (
    org: string,
    building: string,
    request: string,
    vendorId: string,
    estimatedCost?: number,
  ) =>
    api<{ id: string }>(
      `${base(org, building)}/requests/${request}/assign-vendor`,
      "POST",
      { vendorId, estimatedCost },
    ),
  addWorkLog: (
    org: string,
    building: string,
    workOrder: string,
    note: string,
    minutes?: number,
  ) =>
    api<{ id: string }>(
      `${base(org, building)}/work-orders/${workOrder}/logs`,
      "POST",
      { note, minutes },
    ),
  updateWorkCosts: (
    org: string,
    building: string,
    workOrder: string,
    body: { estimatedCost?: number; actualCost?: number },
  ) =>
    api(`${base(org, building)}/work-orders/${workOrder}/costs`, "POST", body),
};
/** Mirrors the backend photo rules: JPEG/PNG/WebP, 1 byte to 10 MB. */
export function photoProblem(file: { type: string; size: number }) {
  if (file.size < 1) return "The selected photo is empty";
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 10 * 1024 * 1024
  )
    return "Choose a JPEG, PNG, or WebP photo up to 10 MB";
  return null;
}
export async function stripPhotoMetadata(file: File) {
  const problem = photoProblem(file);
  if (problem) throw new Error(problem);
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
