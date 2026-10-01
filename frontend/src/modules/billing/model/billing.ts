import { z } from "zod";
import { api, publicApi } from "@/shared/api/client";

export const subscriptionStatuses = [
  "TRIALING",
  "ACTIVE",
  "PAST_DUE",
  "SUSPENDED",
  "CANCELLED",
] as const;
export type SubscriptionStatus = (typeof subscriptionStatuses)[number];
export const billingCycles = ["MONTHLY", "ANNUAL"] as const;
export type BillingCycle = (typeof billingCycles)[number];
export const invoiceStatuses = [
  "DRAFT",
  "ISSUED",
  "OVERDUE",
  "PAID",
  "VOID",
] as const;
export type InvoiceStatus = (typeof invoiceStatuses)[number];

export interface Plan {
  id: string;
  code: string;
  name: string;
  description: string | null;
  monthly_price: number;
  annual_price: number;
  currency: string;
  max_buildings: number | null;
  max_spaces: number | null;
  max_staff: number | null;
  features: string[];
  trial_days: number;
  public: boolean;
  active: boolean;
  sort_order: number;
}

/** Lightweight state any member can read; drives the in-app banner. */
export interface BillingStatus {
  status: SubscriptionStatus;
  planCode: string;
  planName: string;
  trialEndsOn: string | null;
  trialDaysLeft: number | null;
  writable: boolean;
}

export interface Usage {
  buildings: number;
  spaces: number;
  staff: number;
}
export interface Limits {
  buildings: number | null;
  spaces: number | null;
  staff: number | null;
}

export interface BillingOverview {
  organization_id: string;
  plan_id: string;
  plan_code: string;
  plan_name: string;
  status: SubscriptionStatus;
  billing_cycle: BillingCycle;
  trial_ends_on: string | null;
  trial_days_left: number | null;
  current_period_start: string;
  current_period_end: string;
  monthly_price: number;
  annual_price: number;
  currency: string;
  features: string[];
  billing_email: string | null;
  billing_name: string | null;
  billing_address: string | null;
  tax_id: string | null;
  requested_plan_id: string | null;
  requested_cycle: BillingCycle | null;
  requested_at: string | null;
  requested_plan: Plan | null;
  writable: boolean;
  usage: Usage;
  limits: Limits;
}

export interface Invoice {
  id: string;
  organization_id: string;
  organization_name: string;
  number: string;
  plan_id: string | null;
  plan_name: string | null;
  description: string;
  period_start: string | null;
  period_end: string | null;
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  status: InvoiceStatus;
  issued_on: string | null;
  due_on: string | null;
  paid_on: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  notes: string | null;
  created_at: string;
}
export interface InvoiceDetail extends Invoice {
  bill_to: {
    name: string | null;
    email: string | null;
    address: string | null;
    tax_id: string | null;
  };
}

export interface SubscriptionRow {
  organization_id: string;
  organization_name: string;
  organization_active: boolean;
  status: SubscriptionStatus | null;
  billing_cycle: BillingCycle | null;
  trial_ends_on: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  billing_email: string | null;
  plan_id: string | null;
  plan_code: string | null;
  plan_name: string | null;
  monthly_price: number | null;
  annual_price: number | null;
  currency: string | null;
  requested_plan_id: string | null;
  requested_plan_name: string | null;
  requested_cycle: BillingCycle | null;
  requested_at: string | null;
}

export interface RevenueSummary {
  mrr: number;
  arr: number;
  subscriptions: Record<SubscriptionStatus, number>;
  pendingRequests: number;
  outstanding: number;
  overdue: number;
  collectedLast30Days: number;
  currency: string;
}

export const billingProfileSchema = z.object({
  billingEmail: z
    .string()
    .trim()
    .max(254)
    .refine(
      (value) => value === "" || z.string().email().safeParse(value).success,
      {
        message: "Enter a valid email address",
      },
    ),
  billingName: z.string().trim().max(160),
  billingAddress: z.string().trim().max(500),
  taxId: z.string().trim().max(60),
});
export type BillingProfile = z.infer<typeof billingProfileSchema>;

const optionalLimit = z
  .union([z.number().int().min(0), z.nan(), z.null()])
  .transform((value) => (value === null || Number.isNaN(value) ? null : value));
export const planSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_]{2,40}$/, "Use 2-40 letters, digits or underscores"),
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500),
  monthlyPrice: z.number().min(0),
  annualPrice: z.number().min(0),
  currency: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/, "Use a 3-letter code"),
  maxBuildings: optionalLimit,
  maxSpaces: optionalLimit,
  maxStaff: optionalLimit,
  features: z.array(z.string().trim().min(1).max(120)).max(20),
  trialDays: z.number().int().min(0).max(90),
  publiclyListed: z.boolean(),
  active: z.boolean(),
  sortOrder: z.number().int(),
});
export type PlanInput = z.input<typeof planSchema>;

export const newInvoiceSchema = z
  .object({
    organizationId: z.string().uuid("Choose an organization"),
    fromPlan: z.boolean(),
    description: z.string().trim().max(300),
    amount: z.number().min(0).optional(),
    tax: z.number().min(0).optional(),
    notes: z.string().trim().max(1000),
  })
  .refine((value) => value.fromPlan || value.description.length > 0, {
    message: "A description is required",
    path: ["description"],
  })
  .refine((value) => value.fromPlan || value.amount !== undefined, {
    message: "An amount is required",
    path: ["amount"],
  });
export type NewInvoice = z.infer<typeof newInvoiceSchema>;

/** Formats a money amount returned by the API (numeric JSON) for display. */
export function money(
  amount: number | string | null | undefined,
  currency = "USD",
) {
  const value = Number(amount ?? 0);
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

export function limitLabel(limit: number | null, noun: string) {
  return limit === null
    ? `Unlimited ${noun}s`
    : `${limit} ${noun}${limit === 1 ? "" : "s"}`;
}

const org = (organization: string) => `/organizations/${organization}/billing`;

export const billingKeys = {
  all: ["billing"] as const,
  publicPlans: () => ["billing", "public-plans"] as const,
  status: (organization: string) =>
    [organization, "billing", "status"] as const,
  overview: (organization: string) =>
    [organization, "billing", "overview"] as const,
  invoices: (organization: string) =>
    [organization, "billing", "invoices"] as const,
  invoice: (organization: string, invoice: string) =>
    [organization, "billing", "invoices", invoice] as const,
  platform: () => ["platform", "billing"] as const,
};

export const billingApi = {
  publicPlans: () => publicApi<Plan[]>("/public/plans"),
  status: (organization: string) =>
    api<BillingStatus>(`${org(organization)}/status`),
  overview: (organization: string) => api<BillingOverview>(org(organization)),
  updateProfile: (organization: string, body: BillingProfile) =>
    api(org(organization), "PATCH", body),
  requestPlan: (organization: string, planId: string, cycle: BillingCycle) =>
    api(`${org(organization)}/plan-request`, "POST", { planId, cycle }),
  withdrawRequest: (organization: string) =>
    api(`${org(organization)}/plan-request`, "DELETE"),
  invoices: (organization: string) =>
    api<Invoice[]>(`${org(organization)}/invoices`),
  invoice: (organization: string, invoice: string) =>
    api<InvoiceDetail>(`${org(organization)}/invoices/${invoice}`),
};

export const platformBillingApi = {
  summary: () => api<RevenueSummary>("/platform/billing/summary"),
  plans: () => api<Plan[]>("/platform/plans"),
  createPlan: (body: z.output<typeof planSchema>) =>
    api<{ id: string }>("/platform/plans", "POST", body),
  updatePlan: (plan: string, body: z.output<typeof planSchema>) =>
    api(`/platform/plans/${plan}`, "PUT", body),
  subscriptions: (pendingOnly: boolean, status?: SubscriptionStatus) => {
    const params = new URLSearchParams();
    if (pendingOnly) params.set("pending", "true");
    if (status) params.set("status", status);
    const query = params.toString();
    return api<SubscriptionRow[]>(
      `/platform/subscriptions${query ? `?${query}` : ""}`,
    );
  },
  assign: (
    organization: string,
    body: {
      planId: string;
      status: SubscriptionStatus;
      cycle: BillingCycle;
      trialEndsOn?: string;
      periodEnd?: string;
    },
  ) => api(`/platform/subscriptions/${organization}`, "PUT", body),
  approve: (organization: string) =>
    api(`/platform/subscriptions/${organization}/approve-request`, "POST"),
  decline: (organization: string) =>
    api(`/platform/subscriptions/${organization}/decline-request`, "POST"),
  invoices: (status?: InvoiceStatus) =>
    api<Invoice[]>(`/platform/invoices${status ? `?status=${status}` : ""}`),
  invoice: (invoice: string) =>
    api<InvoiceDetail>(`/platform/invoices/${invoice}`),
  createInvoice: (body: NewInvoice) =>
    api<{ id: string }>("/platform/invoices", "POST", {
      organizationId: body.organizationId,
      description: body.description || undefined,
      amount: body.fromPlan ? undefined : body.amount,
      tax: body.tax,
      notes: body.notes || undefined,
    }),
  issue: (invoice: string) =>
    api(`/platform/invoices/${invoice}/issue`, "POST", {}),
  pay: (invoice: string, body: { method: string; reference: string }) =>
    api(`/platform/invoices/${invoice}/pay`, "POST", {
      method: body.method || undefined,
      reference: body.reference || undefined,
    }),
  void: (invoice: string, reason: string) =>
    api(`/platform/invoices/${invoice}/void`, "POST", {
      reason: reason || undefined,
    }),
};
