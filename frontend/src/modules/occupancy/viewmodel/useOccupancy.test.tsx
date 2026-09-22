import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode } from "react";
import { beforeEach, it, expect, vi } from "vitest";
import { useOccupancy } from "./useOccupancy";
import { occupancyApi } from "../model/occupancy";

vi.mock("../model/occupancy", () => ({
  occupancyApi: {
    residents: vi.fn().mockResolvedValue([]),
    createResident: vi.fn().mockResolvedValue(undefined),
    updateResident: vi.fn().mockResolvedValue(undefined),
    assign: vi.fn().mockResolvedValue(undefined),
    end: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock("@/modules/buildings/model/buildings", () => ({
  buildingsApi: { spaces: vi.fn().mockResolvedValue([]) },
}));

let query: QueryClient;
beforeEach(() => {
  vi.clearAllMocks();
  query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={query}>{children}</QueryClientProvider>;
}

it("assigns a resident to a space starting today and invalidates the workspace", async () => {
  const invalidate = vi.spyOn(query, "invalidateQueries");
  const { result } = renderHook(() => useOccupancy("org", "building"), {
    wrapper,
  });
  const today = new Date().toISOString().slice(0, 10);
  let outcome: boolean | undefined;
  await act(async () => {
    outcome = await result.current.assign("resident-1", "space-1");
  });
  expect(outcome).toBe(true);
  expect(occupancyApi.assign).toHaveBeenCalledWith("org", "building", {
    residentId: "resident-1",
    spaceId: "space-1",
    startsOn: today,
  });
  expect(invalidate).toHaveBeenCalledWith({
    queryKey: ["org", "building", "building"],
  });
  expect(result.current.busy).toBe(false);
});

it("ends an assignment as of today", async () => {
  const { result } = renderHook(() => useOccupancy("org", "building"), {
    wrapper,
  });
  const today = new Date().toISOString().slice(0, 10);
  await act(async () => {
    await result.current.end("assignment-1");
  });
  expect(occupancyApi.end).toHaveBeenCalledWith(
    "org",
    "building",
    "assignment-1",
    today,
  );
});

it("surfaces an error and skips invalidation when creating a resident fails", async () => {
  vi.mocked(occupancyApi.createResident).mockRejectedValue(
    new Error("Display name is required"),
  );
  const invalidate = vi.spyOn(query, "invalidateQueries");
  const { result } = renderHook(() => useOccupancy("org", "building"), {
    wrapper,
  });
  let outcome: boolean | undefined;
  await act(async () => {
    outcome = await result.current.create({
      accountId: "account-1",
      displayName: "",
      phone: "",
    });
  });
  expect(outcome).toBe(false);
  expect(result.current.error).toBe("Display name is required");
  expect(invalidate).not.toHaveBeenCalled();
});

it("updates a resident's profile", async () => {
  const { result } = renderHook(() => useOccupancy("org", "building"), {
    wrapper,
  });
  await act(async () => {
    await result.current.update("resident-1", {
      displayName: "New Name",
      phone: "+1 555 0100",
      active: true,
    });
  });
  expect(occupancyApi.updateResident).toHaveBeenCalledWith(
    "org",
    "building",
    "resident-1",
    { displayName: "New Name", phone: "+1 555 0100", active: true },
  );
});
