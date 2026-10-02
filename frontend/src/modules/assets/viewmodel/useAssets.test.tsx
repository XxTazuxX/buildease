import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode } from "react";
import { beforeEach, it, expect, vi } from "vitest";
import { useAssetDetail, useAssets } from "./useAssets";
import { assetsApi } from "../model/assets";

vi.mock("../model/assets", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../model/assets")>();
  return {
    ...actual,
    assetsApi: {
      list: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      detail: vi.fn(),
      setStatus: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn(),
      recordMeterReading: vi.fn(),
    },
  };
});
vi.mock("@/modules/buildings", () => ({
  buildingsApi: { spaces: vi.fn().mockResolvedValue([]) },
}));

const validAsset = { name: "Rooftop HVAC Unit", category: "HVAC" as const };

let query: QueryClient;
beforeEach(() => {
  vi.clearAllMocks();
  query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={query}>{children}</QueryClientProvider>;
}

it("creates a valid asset and invalidates the list", async () => {
  vi.mocked(assetsApi.create).mockResolvedValue({ id: "asset-1" });
  const invalidate = vi.spyOn(query, "invalidateQueries");
  const { result } = renderHook(() => useAssets("org", "building"), {
    wrapper,
  });
  let outcome: boolean | undefined;
  await act(async () => {
    outcome = await result.current.create(validAsset);
  });
  expect(outcome).toBe(true);
  expect(assetsApi.create).toHaveBeenCalledWith("org", "building", validAsset);
  expect(invalidate).toHaveBeenCalledWith({
    queryKey: ["org", "building", "building", "assets"],
  });
});

it("deletes an asset, refreshing the list, and reports a refusal", async () => {
  vi.mocked(assetsApi.remove).mockResolvedValueOnce(undefined);
  const invalidate = vi.spyOn(query, "invalidateQueries");
  const { result } = renderHook(() => useAssets("org", "building"), {
    wrapper,
  });
  await act(async () => {
    expect(await result.current.remove("asset-1")).toBe(true);
  });
  expect(assetsApi.remove).toHaveBeenCalledWith("org", "building", "asset-1");
  expect(invalidate).toHaveBeenCalled();

  vi.mocked(assetsApi.remove).mockRejectedValueOnce(
    new Error("Meter readings are recorded for this asset"),
  );
  await act(async () => {
    expect(await result.current.remove("asset-2")).toBe(false);
  });
  expect(result.current.error).toBe(
    "Meter readings are recorded for this asset",
  );
});

it("retires and reactivates an asset", async () => {
  const { result } = renderHook(() => useAssets("org", "building"), {
    wrapper,
  });
  await act(async () => {
    await result.current.setStatus("asset-1", "RETIRED");
  });
  expect(assetsApi.setStatus).toHaveBeenCalledWith(
    "org",
    "building",
    "asset-1",
    "RETIRED",
  );
});

it("records a meter reading and invalidates the detail query", async () => {
  vi.mocked(assetsApi.recordMeterReading).mockResolvedValue({
    id: "reading-1",
  });
  const invalidate = vi.spyOn(query, "invalidateQueries");
  const { result } = renderHook(
    () => useAssetDetail("org", "building", "asset-1"),
    { wrapper },
  );
  let outcome: boolean | undefined;
  await act(async () => {
    outcome = await result.current.recordMeterReading(1200, "hours");
  });
  expect(outcome).toBe(true);
  expect(assetsApi.recordMeterReading).toHaveBeenCalledWith(
    "org",
    "building",
    "asset-1",
    1200,
    "hours",
  );
  expect(invalidate).toHaveBeenCalledWith({
    queryKey: ["org", "building", "building", "assets", "detail", "asset-1"],
  });
});
