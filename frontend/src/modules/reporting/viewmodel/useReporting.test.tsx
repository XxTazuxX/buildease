import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode } from "react";
import { beforeEach, it, expect, vi } from "vitest";
import {
  useIncomeStatement,
  useLeaseStatement,
  useRentRoll,
} from "./useReporting";
import { reportingApi } from "../model/reporting";

vi.mock("../model/reporting", () => ({
  reportingApi: {
    rentRoll: vi.fn().mockResolvedValue([]),
    incomeStatement: vi.fn().mockResolvedValue({
      from: "2026-01-01",
      to: "2026-01-31",
      totalCharged: "0",
      totalCollected: "0",
      outstandingBalance: "0",
    }),
    leaseStatement: vi.fn().mockResolvedValue({
      from: "2026-01-01",
      to: "2026-01-31",
      openingBalance: "0",
      lines: [],
      closingBalance: "0",
    }),
  },
}));

let query: QueryClient;
beforeEach(() => {
  vi.clearAllMocks();
  query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={query}>{children}</QueryClientProvider>;
}

it("fetches the rent roll for the given building", async () => {
  const { result } = renderHook(() => useRentRoll("org", "building"), {
    wrapper,
  });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(reportingApi.rentRoll).toHaveBeenCalledWith("org", "building");
});

it("does not fetch the rent roll without a building", () => {
  renderHook(() => useRentRoll("org", ""), { wrapper });
  expect(reportingApi.rentRoll).not.toHaveBeenCalled();
});

it("fetches the income statement only once from and to are set", async () => {
  const { result, rerender } = renderHook(
    ({ from, to }) => useIncomeStatement("org", "building", from, to),
    { wrapper, initialProps: { from: "", to: "" } },
  );
  expect(reportingApi.incomeStatement).not.toHaveBeenCalled();
  rerender({ from: "2026-01-01", to: "2026-01-31" });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(reportingApi.incomeStatement).toHaveBeenCalledWith(
    "org",
    "building",
    "2026-01-01",
    "2026-01-31",
  );
});

it("fetches a lease statement only once a lease is selected", async () => {
  const { result, rerender } = renderHook(
    ({ lease }) =>
      useLeaseStatement("org", "building", lease, "2026-01-01", "2026-01-31"),
    { wrapper, initialProps: { lease: "" } },
  );
  expect(reportingApi.leaseStatement).not.toHaveBeenCalled();
  rerender({ lease: "lease-1" });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(reportingApi.leaseStatement).toHaveBeenCalledWith(
    "org",
    "building",
    "lease-1",
    "2026-01-01",
    "2026-01-31",
  );
});
