import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode } from "react";
import { beforeEach, it, expect, vi } from "vitest";
import { useListings } from "./useListings";
import { listingsApi } from "../model/listings";

vi.mock("../model/listings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../model/listings")>();
  return {
    ...actual,
    listingsApi: {
      list: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      detail: vi.fn(),
      publish: vi.fn().mockResolvedValue(undefined),
      unpublish: vi.fn().mockResolvedValue(undefined),
    },
  };
});
vi.mock("@/modules/buildings", () => ({
  buildingsApi: { spaces: vi.fn().mockResolvedValue([]) },
}));

const validListing = {
  spaceId: "11111111-1111-1111-1111-111111111111",
  headline: "Bright 1BR",
  description: "Available now.",
  rentAmount: 1200,
};

let query: QueryClient;
beforeEach(() => {
  vi.clearAllMocks();
  query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={query}>{children}</QueryClientProvider>;
}

it("creates a valid listing and invalidates the list", async () => {
  vi.mocked(listingsApi.create).mockResolvedValue({ id: "listing-1" });
  const invalidate = vi.spyOn(query, "invalidateQueries");
  const { result } = renderHook(() => useListings("org", "building"), {
    wrapper,
  });
  let outcome: boolean | undefined;
  await act(async () => {
    outcome = await result.current.create(validListing);
  });
  expect(outcome).toBe(true);
  expect(listingsApi.create).toHaveBeenCalledWith(
    "org",
    "building",
    validListing,
  );
  expect(invalidate).toHaveBeenCalledWith({
    queryKey: ["org", "building", "building", "listings"],
  });
});

it("publishes and unpublishes through the right endpoints", async () => {
  const { result } = renderHook(() => useListings("org", "building"), {
    wrapper,
  });
  await act(async () => {
    await result.current.publish("listing-1", ["ZILLOW"]);
  });
  expect(listingsApi.publish).toHaveBeenCalledWith(
    "org",
    "building",
    "listing-1",
    ["ZILLOW"],
  );

  await act(async () => {
    await result.current.unpublish("listing-1");
  });
  expect(listingsApi.unpublish).toHaveBeenCalledWith(
    "org",
    "building",
    "listing-1",
  );
});
