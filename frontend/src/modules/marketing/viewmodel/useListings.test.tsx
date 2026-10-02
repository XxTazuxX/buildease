import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode } from "react";
import { beforeEach, it, expect, vi } from "vitest";
import { useListings } from "./useListings";
import { listingsApi } from "../model/listings";
import { notify } from "@/shared/feedback/notify";

vi.mock("../model/listings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../model/listings")>();
  return {
    ...actual,
    listingsApi: {
      list: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      detail: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
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

it("edits a listing without its space and refreshes the list", async () => {
  vi.mocked(listingsApi.update).mockResolvedValue(undefined);
  const invalidate = vi.spyOn(query, "invalidateQueries");
  const { result } = renderHook(() => useListings("org", "building"), {
    wrapper,
  });
  await act(async () => {
    await result.current.update("listing-1", {
      ...validListing,
      headline: "Renovated 1BR",
    });
  });
  expect(listingsApi.update).toHaveBeenCalledWith(
    "org",
    "building",
    "listing-1",
    {
      headline: "Renovated 1BR",
      description: "Available now.",
      rentAmount: 1200,
    },
  );
  expect(invalidate).toHaveBeenCalled();
});

it("rejects an invalid edit before calling the API", async () => {
  const { result } = renderHook(() => useListings("org", "building"), {
    wrapper,
  });
  let ok: boolean | undefined;
  await act(async () => {
    ok = await result.current.update("listing-1", {
      ...validListing,
      headline: "",
    });
  });
  expect(ok).toBe(false);
  expect(listingsApi.update).not.toHaveBeenCalled();
});

it("deletes a listing, refreshing the list, and reports a refusal", async () => {
  vi.mocked(listingsApi.remove).mockResolvedValueOnce(undefined);
  const invalidate = vi.spyOn(query, "invalidateQueries");
  const { result } = renderHook(() => useListings("org", "building"), {
    wrapper,
  });
  await act(async () => {
    expect(await result.current.remove("listing-1")).toBe(true);
  });
  expect(listingsApi.remove).toHaveBeenCalledWith(
    "org",
    "building",
    "listing-1",
  );
  expect(invalidate).toHaveBeenCalled();

  vi.mocked(listingsApi.remove).mockRejectedValueOnce(
    new Error("Unpublish the listing before deleting it"),
  );
  await act(async () => {
    expect(await result.current.remove("listing-2")).toBe(false);
  });
  expect(result.current.error).toBe("Unpublish the listing before deleting it");
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

it("removes a listing from the cached list before the server answers", async () => {
  const rows = [
    { id: "a", headline: "Corner unit" },
    { id: "b", headline: "Penthouse" },
  ];
  vi.mocked(listingsApi.list).mockResolvedValue(rows as never);
  let finish: () => void = () => {};
  vi.mocked(listingsApi.remove).mockReturnValueOnce(
    new Promise<void>((resolve) => {
      finish = resolve;
    }),
  );
  const { result } = renderHook(() => useListings("org", "building"), {
    wrapper,
  });
  await waitFor(() => expect(result.current.list.data).toHaveLength(2));

  let done: Promise<boolean> = Promise.resolve(false);
  act(() => {
    done = result.current.remove("a");
  });
  await waitFor(() =>
    expect(result.current.list.data?.map((row) => row.id)).toEqual(["b"]),
  );
  await act(async () => {
    finish();
    await done;
  });
  expect(await done).toBe(true);
});

it("restores the row and raises an error toast when a delete is refused", async () => {
  notify.clear();
  const rows = [
    { id: "a", headline: "Corner unit" },
    { id: "b", headline: "Penthouse" },
  ];
  vi.mocked(listingsApi.list).mockResolvedValue(rows as never);
  vi.mocked(listingsApi.remove).mockRejectedValueOnce(
    new Error("Listing is published"),
  );
  const { result } = renderHook(() => useListings("org", "building"), {
    wrapper,
  });
  await waitFor(() => expect(result.current.list.data).toHaveLength(2));

  await act(async () => {
    expect(await result.current.remove("a")).toBe(false);
  });

  expect(result.current.list.data?.map((row) => row.id)).toEqual(["a", "b"]);
  expect(notify.snapshot().map((toast) => toast.message)).toContain(
    "Listing is published",
  );
});
