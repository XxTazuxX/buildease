import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode } from "react";
import { beforeEach, it, expect, vi } from "vitest";
import { useLeases } from "./useLeases";
import { leasesApi } from "../model/leases";

vi.mock("../model/leases", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../model/leases")>();
  return {
    ...actual,
    leasesApi: {
      list: vi.fn().mockResolvedValue([]),
      detail: vi.fn(),
      create: vi.fn(),
      activate: vi.fn().mockResolvedValue(undefined),
      cancel: vi.fn().mockResolvedValue(undefined),
      end: vi.fn().mockResolvedValue(undefined),
      recordPayment: vi.fn(),
      recordDeposit: vi.fn(),
      refundDeposit: vi.fn().mockResolvedValue(undefined),
      forfeitDeposit: vi.fn().mockResolvedValue(undefined),
    },
  };
});
vi.mock("@/modules/occupancy/model/occupancy", () => ({
  occupancyApi: { residents: vi.fn().mockResolvedValue([]) },
}));
vi.mock("@/modules/buildings/model/buildings", () => ({
  buildingsApi: { spaces: vi.fn().mockResolvedValue([]) },
}));

const validLease = {
  residentId: "11111111-1111-1111-1111-111111111111",
  spaceId: "22222222-2222-2222-2222-222222222222",
  startsOn: "2026-01-01",
  rentAmount: 1200,
  firstChargeOn: "2026-01-01",
};

let query: QueryClient;
beforeEach(() => {
  vi.clearAllMocks();
  query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={query}>{children}</QueryClientProvider>;
}

it("creates a valid lease and invalidates the shared query key", async () => {
  vi.mocked(leasesApi.create).mockResolvedValue({ id: "lease-1" });
  const invalidate = vi.spyOn(query, "invalidateQueries");
  const { result } = renderHook(() => useLeases("org", "building"), {
    wrapper,
  });
  let outcome: boolean | undefined;
  await act(async () => {
    outcome = await result.current.create(validLease);
  });
  expect(outcome).toBe(true);
  expect(leasesApi.create).toHaveBeenCalledWith("org", "building", validLease);
  expect(invalidate).toHaveBeenCalledWith({
    queryKey: ["org", "building", "building", "leases"],
  });
  expect(result.current.error).toBe("");
});

it("rejects an invalid lease before calling the API", async () => {
  const { result } = renderHook(() => useLeases("org", "building"), {
    wrapper,
  });
  let outcome: boolean | undefined;
  await act(async () => {
    outcome = await result.current.create({ ...validLease, rentAmount: 0 });
  });
  expect(outcome).toBe(false);
  expect(leasesApi.create).not.toHaveBeenCalled();
  expect(result.current.error).not.toBe("");
});

it("activates, cancels and ends a lease through the right endpoints", async () => {
  const { result } = renderHook(() => useLeases("org", "building"), {
    wrapper,
  });
  await act(async () => {
    await result.current.activate("lease-1");
  });
  expect(leasesApi.activate).toHaveBeenCalledWith("org", "building", "lease-1");

  await act(async () => {
    await result.current.cancel("lease-1");
  });
  expect(leasesApi.cancel).toHaveBeenCalledWith("org", "building", "lease-1");

  await act(async () => {
    await result.current.end("lease-1", "2026-06-01", "TERMINATED");
  });
  expect(leasesApi.end).toHaveBeenCalledWith(
    "org",
    "building",
    "lease-1",
    "2026-06-01",
    "TERMINATED",
  );
});

it("records a payment and a deposit with the given details", async () => {
  vi.mocked(leasesApi.recordPayment).mockResolvedValue({ id: "payment-1" });
  vi.mocked(leasesApi.recordDeposit).mockResolvedValue({ id: "deposit-1" });
  const { result } = renderHook(() => useLeases("org", "building"), {
    wrapper,
  });

  await act(async () => {
    await result.current.recordPayment("lease-1", {
      amount: 500,
      method: "CASH",
      receivedOn: "2026-01-05",
    });
  });
  expect(leasesApi.recordPayment).toHaveBeenCalledWith(
    "org",
    "building",
    "lease-1",
    {
      amount: 500,
      method: "CASH",
      receivedOn: "2026-01-05",
    },
  );

  await act(async () => {
    await result.current.recordDeposit("lease-1", {
      amount: 1200,
      heldOn: "2026-01-01",
    });
  });
  expect(leasesApi.recordDeposit).toHaveBeenCalledWith(
    "org",
    "building",
    "lease-1",
    {
      amount: 1200,
      heldOn: "2026-01-01",
    },
  );
});

it("surfaces the server error and does not invalidate when recording a payment is forbidden", async () => {
  vi.mocked(leasesApi.recordPayment).mockRejectedValue(new Error("Forbidden"));
  const invalidate = vi.spyOn(query, "invalidateQueries");
  const { result } = renderHook(() => useLeases("org", "building"), {
    wrapper,
  });
  let outcome: boolean | undefined;
  await act(async () => {
    outcome = await result.current.recordPayment("lease-1", {
      amount: 500,
      method: "CASH",
      receivedOn: "2026-01-05",
    });
  });
  expect(outcome).toBe(false);
  await waitFor(() => expect(result.current.error).toBe("Forbidden"));
  expect(invalidate).not.toHaveBeenCalled();
});
