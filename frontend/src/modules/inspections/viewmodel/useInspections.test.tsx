import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode } from "react";
import { beforeEach, it, expect, vi } from "vitest";
import { useInspectionDetail, useInspections } from "./useInspections";
import { inspectionsApi } from "../model/inspections";

vi.mock("../model/inspections", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../model/inspections")>();
  return {
    ...actual,
    inspectionsApi: {
      list: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      detail: vi.fn(),
      addItem: vi.fn(),
      complete: vi.fn().mockResolvedValue(undefined),
      acknowledge: vi.fn().mockResolvedValue(undefined),
      preparePhoto: vi.fn(),
    },
  };
});
vi.mock("@/modules/maintenance", () => ({
  stripPhotoMetadata: vi.fn(async (file: File) => file),
}));
vi.mock("@/modules/buildings", () => ({
  buildingsApi: { spaces: vi.fn().mockResolvedValue([]) },
}));
vi.mock("@/modules/occupancy", () => ({
  occupancyApi: { residents: vi.fn().mockResolvedValue([]) },
}));

const validInspection = {
  spaceId: "11111111-1111-1111-1111-111111111111",
  type: "MOVE_IN" as const,
  scheduledOn: "2026-01-01",
};

let query: QueryClient;
beforeEach(() => {
  vi.clearAllMocks();
  query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={query}>{children}</QueryClientProvider>;
}

it("creates a valid inspection and invalidates the list", async () => {
  vi.mocked(inspectionsApi.create).mockResolvedValue({ id: "inspection-1" });
  const invalidate = vi.spyOn(query, "invalidateQueries");
  const { result } = renderHook(() => useInspections("org", "building", 0), {
    wrapper,
  });
  let outcome: boolean | undefined;
  await act(async () => {
    outcome = await result.current.create(validInspection);
  });
  expect(outcome).toBe(true);
  expect(inspectionsApi.create).toHaveBeenCalledWith(
    "org",
    "building",
    validInspection,
  );
  expect(invalidate).toHaveBeenCalledWith({
    queryKey: ["org", "building", "building", "inspections"],
  });
});

it("completes and acknowledges an inspection through the right endpoints", async () => {
  const { result } = renderHook(() => useInspections("org", "building", 0), {
    wrapper,
  });
  await act(async () => {
    await result.current.complete("inspection-1", "All good");
  });
  expect(inspectionsApi.complete).toHaveBeenCalledWith(
    "org",
    "building",
    "inspection-1",
    "All good",
  );

  await act(async () => {
    await result.current.acknowledge("inspection-1");
  });
  expect(inspectionsApi.acknowledge).toHaveBeenCalledWith(
    "org",
    "building",
    "inspection-1",
  );
});

it("uploads a stripped photo and invalidates the detail query", async () => {
  vi.mocked(inspectionsApi.preparePhoto).mockResolvedValue({
    id: "photo-1",
    uploadUrl: "https://example.test/upload",
    contentType: "image/png",
  });
  const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response);
  vi.stubGlobal("fetch", fetchMock);
  const { result } = renderHook(
    () => useInspectionDetail("org", "building", "inspection-1"),
    { wrapper },
  );
  const file = new File(["data"], "photo.png", { type: "image/png" });
  let outcome: boolean | undefined;
  await act(async () => {
    outcome = await result.current.uploadPhoto(file);
  });
  expect(outcome).toBe(true);
  expect(inspectionsApi.preparePhoto).toHaveBeenCalledWith(
    "org",
    "building",
    "inspection-1",
    file,
  );
  expect(fetchMock).toHaveBeenCalledWith(
    "https://example.test/upload",
    expect.objectContaining({ method: "PUT" }),
  );
  vi.unstubAllGlobals();
});
