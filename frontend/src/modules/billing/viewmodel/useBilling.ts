import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  billingApi,
  billingKeys,
  billingProfileSchema,
  newInvoiceSchema,
  planSchema,
  platformBillingApi,
  type BillingCycle,
  type BillingProfile,
  type InvoiceStatus,
  type NewInvoice,
  type PlanInput,
  type SubscriptionStatus,
} from "../model/billing";
import { reportError } from "@/shared/feedback/reportError";

/** Runs a mutation with shared busy/error state, then invalidates the given query keys. */
function useMutationRunner() {
  const cache = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = async (
    operation: () => Promise<unknown>,
    keys: readonly (readonly unknown[])[],
  ) => {
    setBusy(true);
    setError("");
    try {
      await operation();
      await Promise.all(
        keys.map((queryKey) => cache.invalidateQueries({ queryKey })),
      );
      return true;
    } catch (cause) {
      setError(reportError(cause, "Operation failed"));
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run, clearError: () => setError("") };
}

export function usePublicPlans() {
  return useQuery({
    queryKey: billingKeys.publicPlans(),
    queryFn: billingApi.publicPlans,
    staleTime: 5 * 60_000,
  });
}

export function useBillingStatus(org: string) {
  return useQuery({
    queryKey: billingKeys.status(org),
    queryFn: () => billingApi.status(org),
    enabled: !!org,
    staleTime: 60_000,
  });
}

export function useBilling(org: string) {
  const runner = useMutationRunner();
  const overview = useQuery({
    queryKey: billingKeys.overview(org),
    queryFn: () => billingApi.overview(org),
    enabled: !!org,
  });
  const invoices = useQuery({
    queryKey: billingKeys.invoices(org),
    queryFn: () => billingApi.invoices(org),
    enabled: !!org,
  });
  const plans = usePublicPlans();
  const refresh = [billingKeys.overview(org), billingKeys.status(org)];
  return {
    overview,
    invoices,
    plans,
    busy: runner.busy,
    error: runner.error,
    updateProfile: (profile: BillingProfile) =>
      runner.run(
        () =>
          billingApi.updateProfile(org, billingProfileSchema.parse(profile)),
        refresh,
      ),
    requestPlan: (planId: string, cycle: BillingCycle) =>
      runner.run(() => billingApi.requestPlan(org, planId, cycle), refresh),
    withdrawRequest: () =>
      runner.run(() => billingApi.withdrawRequest(org), refresh),
  };
}

export function useInvoice(org: string, invoice: string, platform = false) {
  return useQuery({
    queryKey: platform
      ? [...billingKeys.platform(), "invoice", invoice]
      : billingKeys.invoice(org, invoice),
    queryFn: () =>
      platform
        ? platformBillingApi.invoice(invoice)
        : billingApi.invoice(org, invoice),
    enabled: !!invoice && (platform || !!org),
  });
}

export function usePlatformBilling(filters: {
  pendingOnly: boolean;
  subscriptionStatus?: SubscriptionStatus;
  invoiceStatus?: InvoiceStatus;
}) {
  const runner = useMutationRunner();
  const key = billingKeys.platform();
  const summary = useQuery({
    queryKey: [...key, "summary"],
    queryFn: platformBillingApi.summary,
  });
  const plans = useQuery({
    queryKey: [...key, "plans"],
    queryFn: platformBillingApi.plans,
  });
  const subscriptions = useQuery({
    queryKey: [
      ...key,
      "subscriptions",
      filters.pendingOnly,
      filters.subscriptionStatus,
    ],
    queryFn: () =>
      platformBillingApi.subscriptions(
        filters.pendingOnly,
        filters.subscriptionStatus,
      ),
  });
  const invoices = useQuery({
    queryKey: [...key, "invoices", filters.invoiceStatus],
    queryFn: () => platformBillingApi.invoices(filters.invoiceStatus),
  });
  const all = [key, billingKeys.publicPlans()];
  return {
    summary,
    plans,
    subscriptions,
    invoices,
    busy: runner.busy,
    error: runner.error,
    clearError: runner.clearError,
    savePlan: (plan: string | null, input: PlanInput) =>
      runner.run(() => {
        const body = planSchema.parse(input);
        return plan
          ? platformBillingApi.updatePlan(plan, body)
          : platformBillingApi.createPlan(body);
      }, all),
    assign: (
      organization: string,
      body: {
        planId: string;
        status: SubscriptionStatus;
        cycle: BillingCycle;
        trialEndsOn?: string;
        periodEnd?: string;
      },
    ) => runner.run(() => platformBillingApi.assign(organization, body), all),
    approve: (organization: string) =>
      runner.run(() => platformBillingApi.approve(organization), all),
    decline: (organization: string) =>
      runner.run(() => platformBillingApi.decline(organization), all),
    createInvoice: (input: NewInvoice) =>
      runner.run(
        () => platformBillingApi.createInvoice(newInvoiceSchema.parse(input)),
        all,
      ),
    issue: (invoice: string) =>
      runner.run(() => platformBillingApi.issue(invoice), all),
    pay: (invoice: string, method: string, reference: string) =>
      runner.run(
        () => platformBillingApi.pay(invoice, { method, reference }),
        all,
      ),
    voidInvoice: (invoice: string, reason: string) =>
      runner.run(() => platformBillingApi.void(invoice, reason), all),
  };
}
