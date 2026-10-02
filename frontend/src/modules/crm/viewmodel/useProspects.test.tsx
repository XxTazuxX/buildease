import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode } from "react";
import { beforeEach, it, expect, vi } from "vitest";
import { useProspectLeases, useProspects } from "./useProspects";
import { prospectsApi } from "../model/prospects";

vi.mock("../model/prospects", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../model/prospects")>();
  return {
    ...actual,
    prospectsApi: {
      list: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      detail: vi.fn(),
      updateStatus: vi.fn().mockResolvedValue(undefined),
      linkLease: vi.fn().mockResolvedValue(undefined),
      update: vi.fn(),
      remove: vi.fn(),
    },
  };
});
vi.mock("@/modules/buildings", () => ({
  buildingsApi: { spaces: vi.fn().mockResolvedValue([]) },
}));
vi.mock("@/modules/leases", () => ({
  leasesApi: {
    list: vi.fn().mockResolvedValue([{ id: "lease-1", status: "DRAFT" }]),
  },
}));

const validProspect = {
  spaceId: "11111111-1111-1111-1111-111111111111",
  name: "Jane Prospect",
};

let query: QueryClient;
beforeEach(() => {
  vi.clearAllMocks();
  query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={query}>{children}</QueryClientProvider>;
}

it("creates a valid prospect and invalidates the list", async () => {
  vi.mocked(prospectsApi.create).mockResolvedValue({ id: "prospect-1" });
  const invalidate = vi.spyOn(query, "invalidateQueries");
  const { result } = renderHook(() => useProspects("org", "building"), {
    wrapper,
  });
  let outcome: boolean | undefined;
  await act(async () => {
    outcome = await result.current.create(validProspect);
  });
  expect(outcome).toBe(true);
  expect(prospectsApi.create).toHaveBeenCalledWith(
    "org",
    "building",
    validProspect,
  );
  expect(invalidate).toHaveBeenCalledWith({
    queryKey: ["org", "building", "building", "prospects"],
  });
});

it("edits a prospect without its space and refreshes the list", async () => {
  vi.mocked(prospectsApi.update).mockResolvedValue(undefined);
  const invalidate = vi.spyOn(query, "invalidateQueries");
  const { result } = renderHook(() => useProspects("org", "building"), {
    wrapper,
  });
  await act(async () => {
    await result.current.update("prospect-1", {
      ...validProspect,
      name: "  Jane Q. Prospect ",
    });
  });
  expect(prospectsApi.update).toHaveBeenCalledWith(
    "org",
    "building",
    "prospect-1",
    { name: "Jane Q. Prospect" },
  );
  expect(invalidate).toHaveBeenCalled();
});

it("rejects an invalid edit before calling the API", async () => {
  const { result } = renderHook(() => useProspects("org", "building"), {
    wrapper,
  });
  let ok: boolean | undefined;
  await act(async () => {
    ok = await result.current.update("prospect-1", {
      ...validProspect,
      name: "",
    });
  });
  expect(ok).toBe(false);
  expect(prospectsApi.update).not.toHaveBeenCalled();
});

it("deletes a prospect, refreshing the list, and reports a refusal", async () => {
  vi.mocked(prospectsApi.remove).mockResolvedValueOnce(undefined);
  const invalidate = vi.spyOn(query, "invalidateQueries");
  const { result } = renderHook(() => useProspects("org", "building"), {
    wrapper,
  });
  await act(async () => {
    expect(await result.current.remove("prospect-1")).toBe(true);
  });
  expect(prospectsApi.remove).toHaveBeenCalledWith(
    "org",
    "building",
    "prospect-1",
  );
  expect(invalidate).toHaveBeenCalled();

  vi.mocked(prospectsApi.remove).mockRejectedValueOnce(
    new Error("Screening records exist for this prospect"),
  );
  await act(async () => {
    expect(await result.current.remove("prospect-2")).toBe(false);
  });
  expect(result.current.error).toBe(
    "Screening records exist for this prospect",
  );
});

it("updates status and links a lease through the right endpoints", async () => {
  const { result } = renderHook(() => useProspects("org", "building"), {
    wrapper,
  });
  await act(async () => {
    await result.current.updateStatus("prospect-1", "CONTACTED");
  });
  expect(prospectsApi.updateStatus).toHaveBeenCalledWith(
    "org",
    "building",
    "prospect-1",
    "CONTACTED",
    undefined,
  );

  await act(async () => {
    await result.current.linkLease("prospect-1", "lease-1");
  });
  expect(prospectsApi.linkLease).toHaveBeenCalledWith(
    "org",
    "building",
    "prospect-1",
    "lease-1",
  );
});

it("loads the building's leases for linking, sharing the leases cache key", async () => {
  const { result } = renderHook(() => useProspectLeases("org", "building"), {
    wrapper,
  });
  await waitFor(() => expect(result.current.data).toHaveLength(1));
  expect(query.getQueryData(["org", "building", "building", "leases"])).toEqual(
    [{ id: "lease-1", status: "DRAFT" }],
  );
});
