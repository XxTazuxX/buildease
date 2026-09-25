import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode } from "react";
import { beforeEach, it, expect, vi } from "vitest";
import { useProspects } from "./useProspects";
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
    },
  };
});
vi.mock("@/modules/buildings", () => ({
  buildingsApi: { spaces: vi.fn().mockResolvedValue([]) },
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
