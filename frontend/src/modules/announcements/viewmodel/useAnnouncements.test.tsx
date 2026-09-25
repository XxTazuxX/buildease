import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode } from "react";
import { beforeEach, it, expect, vi } from "vitest";
import { useAnnouncements } from "./useAnnouncements";
import { announcementsApi } from "../model/announcements";

vi.mock("../model/announcements", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../model/announcements")>();
  return {
    ...actual,
    announcementsApi: {
      history: vi.fn().mockResolvedValue([]),
      send: vi.fn(),
      detail: vi.fn(),
    },
  };
});

let query: QueryClient;
beforeEach(() => {
  vi.clearAllMocks();
  query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={query}>{children}</QueryClientProvider>;
}

it("sends a valid announcement and invalidates the history query", async () => {
  vi.mocked(announcementsApi.send).mockResolvedValue({ id: "ann-1" });
  const invalidate = vi.spyOn(query, "invalidateQueries");
  const { result } = renderHook(() => useAnnouncements("org", "building", 0), {
    wrapper,
  });
  let outcome: boolean | undefined;
  await act(async () => {
    outcome = await result.current.send({
      title: "Water shutoff",
      body: "Water will be off from 10am to noon.",
      audience: "ALL_RESIDENTS",
    });
  });
  expect(outcome).toBe(true);
  expect(announcementsApi.send).toHaveBeenCalledWith("org", "building", {
    title: "Water shutoff",
    body: "Water will be off from 10am to noon.",
    audience: "ALL_RESIDENTS",
  });
  expect(invalidate).toHaveBeenCalledWith({
    queryKey: ["org", "building", "building", "announcements"],
  });
  expect(result.current.error).toBe("");
});

it("rejects a blank announcement before calling the API", async () => {
  const { result } = renderHook(() => useAnnouncements("org", "building", 0), {
    wrapper,
  });
  let outcome: boolean | undefined;
  await act(async () => {
    outcome = await result.current.send({
      title: "",
      body: "Body",
      audience: "ALL_RESIDENTS",
    });
  });
  expect(outcome).toBe(false);
  expect(announcementsApi.send).not.toHaveBeenCalled();
  expect(result.current.error).not.toBe("");
});
