import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { billingApi, billingKeys, platformBillingApi } from "../model/billing";
import { useBilling, usePlatformBilling } from "./useBilling";

vi.mock("../model/billing", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../model/billing")>();
  return {
    ...actual,
    billingApi: {
      publicPlans: vi.fn().mockResolvedValue([]),
      status: vi.fn(),
      overview: vi.fn().mockResolvedValue({ plan_name: "Starter" }),
      updateProfile: vi.fn().mockResolvedValue(undefined),
      requestPlan: vi.fn().mockResolvedValue(undefined),
      withdrawRequest: vi.fn().mockResolvedValue(undefined),
      invoices: vi.fn().mockResolvedValue([]),
      invoice: vi.fn(),
    },
    platformBillingApi: {
      summary: vi.fn().mockResolvedValue({}),
      plans: vi.fn().mockResolvedValue([]),
      subscriptions: vi.fn().mockResolvedValue([]),
      invoices: vi.fn().mockResolvedValue([]),
      createPlan: vi.fn(),
      updatePlan: vi.fn(),
      assign: vi.fn().mockResolvedValue(undefined),
      approve: vi.fn().mockResolvedValue(undefined),
      decline: vi.fn(),
      invoice: vi.fn(),
      createInvoice: vi.fn(),
      issue: vi.fn(),
      pay: vi.fn().mockRejectedValue(new Error("Invoice is PAID")),
      void: vi.fn(),
    },
  };
});

let query: QueryClient;
beforeEach(() => {
  vi.clearAllMocks();
  query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={query}>{children}</QueryClientProvider>;
}

it("loads the overview and requests a plan change, refreshing billing state", async () => {
  const invalidate = vi.spyOn(query, "invalidateQueries");
  const { result } = renderHook(() => useBilling("org"), { wrapper });
  await waitFor(() =>
    expect(result.current.overview.data).toEqual({ plan_name: "Starter" }),
  );
  let ok: boolean | undefined;
  await act(async () => {
    ok = await result.current.requestPlan("plan-1", "ANNUAL");
  });
  expect(ok).toBe(true);
  expect(billingApi.requestPlan).toHaveBeenCalledWith(
    "org",
    "plan-1",
    "ANNUAL",
  );
  expect(invalidate).toHaveBeenCalledWith({
    queryKey: billingKeys.overview("org"),
  });
  expect(invalidate).toHaveBeenCalledWith({
    queryKey: billingKeys.status("org"),
  });
});

it("validates the billing profile before saving it", async () => {
  const { result } = renderHook(() => useBilling("org"), { wrapper });
  let ok: boolean | undefined;
  await act(async () => {
    ok = await result.current.updateProfile({
      billingEmail: "not-an-email",
      billingName: "",
      billingAddress: "",
      taxId: "",
    });
  });
  expect(ok).toBe(false);
  expect(billingApi.updateProfile).not.toHaveBeenCalled();
  expect(result.current.error).not.toBe("");
});

it("surfaces platform action failures and succeeds on approval", async () => {
  const { result } = renderHook(
    () => usePlatformBilling({ pendingOnly: true }),
    { wrapper },
  );
  await waitFor(() =>
    expect(platformBillingApi.subscriptions).toHaveBeenCalledWith(
      true,
      undefined,
    ),
  );
  let ok: boolean | undefined;
  await act(async () => {
    ok = await result.current.pay("inv-1", "Bank", "REF");
  });
  expect(ok).toBe(false);
  expect(result.current.error).toBe("Invoice is PAID");
  await act(async () => {
    ok = await result.current.approve("org-1");
  });
  expect(ok).toBe(true);
  expect(platformBillingApi.approve).toHaveBeenCalledWith("org-1");
});
