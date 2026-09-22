import { z } from "zod";
import { api } from "@/shared/api/client";

export const leaseStatuses = ["DRAFT", "ACTIVE", "ENDED", "CANCELLED"] as const;
export const paymentMethods = [
  "CASH",
  "BANK_TRANSFER",
  "CHECK",
  "CARD",
  "OTHER",
] as const;
export const leaseEndReasons = ["EXPIRED", "TERMINATED"] as const;
export type LeaseStatus = (typeof leaseStatuses)[number];
export type PaymentMethod = (typeof paymentMethods)[number];
export type LeaseEndReason = (typeof leaseEndReasons)[number];

export interface Lease {
  id: string;
  resident_id: string;
  space_id: string;
  assignment_id: string | null;
  status: LeaseStatus;
  starts_on: string;
  ends_on: string | null;
  rent_amount: string;
  currency: string;
  next_charge_on: string;
  ended_on: string | null;
  end_reason: LeaseEndReason | null;
}
export interface Charge {
  id: string;
  type: "RENT";
  amount: string;
  currency: string;
  due_on: string;
  created_at: string;
}
export interface Payment {
  id: string;
  amount: string;
  currency: string;
  method: PaymentMethod;
  reference: string | null;
  received_on: string;
  recorded_by: string;
  notes: string | null;
  created_at: string;
}
export interface Deposit {
  id: string;
  status: "HELD" | "REFUNDED" | "FORFEITED";
  amount: string;
  held_on: string;
  refunded_on: string | null;
  refunded_amount: string | null;
  notes: string | null;
}
export interface LeaseDetail extends Lease {
  charges: Charge[];
  payments: Payment[];
  deposit: Deposit | null;
  balance: string;
}

export const leaseSchema = z.object({
  residentId: z.string().uuid(),
  spaceId: z.string().uuid(),
  startsOn: z.string().min(1),
  endsOn: z.string().optional(),
  rentAmount: z.coerce.number().positive(),
  firstChargeOn: z.string().min(1),
  depositAmount: z.coerce.number().nonnegative().optional(),
  depositHeldOn: z.string().optional(),
});
export type NewLease = z.infer<typeof leaseSchema>;

const base = (org: string, building: string) =>
  `/organizations/${org}/buildings/${building}/leases`;
export const leasesApi = {
  list: (org: string, building: string) => api<Lease[]>(base(org, building)),
  detail: (org: string, building: string, lease: string) =>
    api<LeaseDetail>(`${base(org, building)}/${lease}`),
  create: (org: string, building: string, body: NewLease) =>
    api<{ id: string }>(base(org, building), "POST", body),
  activate: (org: string, building: string, lease: string) =>
    api(`${base(org, building)}/${lease}/activate`, "POST"),
  cancel: (org: string, building: string, lease: string) =>
    api(`${base(org, building)}/${lease}/cancel`, "POST"),
  end: (
    org: string,
    building: string,
    lease: string,
    endsOn: string,
    reason: LeaseEndReason,
  ) => api(`${base(org, building)}/${lease}/end`, "POST", { endsOn, reason }),
  recordPayment: (
    org: string,
    building: string,
    lease: string,
    body: {
      amount: number;
      method: PaymentMethod;
      reference?: string;
      receivedOn: string;
      notes?: string;
    },
  ) =>
    api<{ id: string }>(
      `${base(org, building)}/${lease}/payments`,
      "POST",
      body,
    ),
  recordDeposit: (
    org: string,
    building: string,
    lease: string,
    body: { amount: number; heldOn: string },
  ) =>
    api<{ id: string }>(
      `${base(org, building)}/${lease}/deposit`,
      "POST",
      body,
    ),
  refundDeposit: (
    org: string,
    building: string,
    lease: string,
    body: { refundedOn: string; refundedAmount: number; notes?: string },
  ) => api(`${base(org, building)}/${lease}/deposit/refund`, "POST", body),
  forfeitDeposit: (
    org: string,
    building: string,
    lease: string,
    reason: string,
  ) =>
    api(`${base(org, building)}/${lease}/deposit/forfeit`, "POST", { reason }),
};
