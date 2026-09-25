import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode } from "react";
import { beforeEach, it, expect, vi } from "vitest";
import { useScreenings } from "./useScreenings";
import { screeningsApi } from "../model/screenings";

vi.mock("../model/screenings", () => ({
  screeningsApi: {
    list: vi.fn().mockResolvedValue([]),
    request: vi.fn(),
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

it("requests a screening and invalidates both the screening and prospect lists", async () => {
  vi.mocked(screeningsApi.request).mockResolvedValue({ id: "screening-1" });
  const invalidate = vi.spyOn(query, "invalidateQueries");
  const { result } = renderHook(
    () => useScreenings("org", "building", "prospect-1"),
    { wrapper },
  );
  let outcome: boolean | undefined;
  await act(async () => {
    outcome = await result.current.request();
  });
  expect(outcome).toBe(true);
  expect(screeningsApi.request).toHaveBeenCalledWith(
    "org",
    "building",
    "prospect-1",
  );
  expect(invalidate).toHaveBeenCalledWith({
    queryKey: [
      "org",
      "building",
      "building",
      "prospects",
      "prospect-1",
      "screenings",
    ],
  });
  expect(invalidate).toHaveBeenCalledWith({
    queryKey: ["org", "building", "building", "prospects"],
  });
});

it("surfaces an error when the request fails", async () => {
  vi.mocked(screeningsApi.request).mockRejectedValue(
    new Error("Prospect must have applied before screening"),
  );
  const { result } = renderHook(
    () => useScreenings("org", "building", "prospect-1"),
    { wrapper },
  );
  let outcome: boolean | undefined;
  await act(async () => {
    outcome = await result.current.request();
  });
  expect(outcome).toBe(false);
  await waitFor(() =>
    expect(result.current.error).toBe(
      "Prospect must have applied before screening",
    ),
  );
});
