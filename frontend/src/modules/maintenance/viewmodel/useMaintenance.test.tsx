import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode } from "react";
import { beforeEach, it, expect, vi } from "vitest";
import { useMaintenance } from "./useMaintenance";
import { maintenanceApi, stripPhotoMetadata } from "../model/maintenance";

vi.mock("../model/maintenance", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../model/maintenance")>();
  return {
    ...actual,
    maintenanceApi: {
      categories: vi.fn().mockResolvedValue([]),
      requests: vi.fn().mockResolvedValue([]),
      submit: vi.fn(),
      triage: vi.fn().mockResolvedValue(undefined),
      start: vi.fn().mockResolvedValue(undefined),
      resolve: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      createCategory: vi.fn().mockResolvedValue(undefined),
      preparePhoto: vi.fn(),
    },
    stripPhotoMetadata: vi.fn(),
  };
});
vi.mock("@/modules/buildings/model/buildings", () => ({
  buildingsApi: { spaces: vi.fn().mockResolvedValue([]) },
}));

const validRequest = {
  spaceId: "11111111-1111-1111-1111-111111111111",
  categoryId: "22222222-2222-2222-2222-222222222222",
  title: "Leaking tap",
  description: "Water is dripping",
  impact: "MEDIUM" as const,
  danger: false,
};

let query: QueryClient;
beforeEach(() => {
  vi.clearAllMocks();
  query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={query}>{children}</QueryClientProvider>;
}

it("submits a valid request without a photo", async () => {
  vi.mocked(maintenanceApi.submit).mockResolvedValue({ id: "req-1" });
  const { result } = renderHook(() => useMaintenance("org", "building"), {
    wrapper,
  });
  let outcome: boolean | undefined;
  await act(async () => {
    outcome = await result.current.submit(validRequest);
  });
  expect(outcome).toBe(true);
  expect(maintenanceApi.submit).toHaveBeenCalledWith(
    "org",
    "building",
    validRequest,
  );
  expect(maintenanceApi.preparePhoto).not.toHaveBeenCalled();
  expect(result.current.error).toBe("");
});

it("rejects an invalid request before calling the API", async () => {
  const { result } = renderHook(() => useMaintenance("org", "building"), {
    wrapper,
  });
  let outcome: boolean | undefined;
  await act(async () => {
    outcome = await result.current.submit({ ...validRequest, title: "" });
  });
  expect(outcome).toBe(false);
  expect(maintenanceApi.submit).not.toHaveBeenCalled();
  expect(result.current.error).not.toBe("");
});

it("keeps the request saved but surfaces an error when the photo upload fails", async () => {
  vi.mocked(maintenanceApi.submit).mockResolvedValue({ id: "req-1" });
  vi.mocked(stripPhotoMetadata).mockResolvedValue(
    new Blob(["x"], { type: "image/png" }),
  );
  vi.mocked(maintenanceApi.preparePhoto).mockResolvedValue({
    id: "photo-1",
    uploadUrl: "https://storage.example.test/upload",
    contentType: "image/png",
  });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false } as Response));
  const { result } = renderHook(() => useMaintenance("org", "building"), {
    wrapper,
  });
  const file = new File(["data"], "leak.png", { type: "image/png" });
  let outcome: boolean | undefined;
  await act(async () => {
    outcome = await result.current.submit(validRequest, file);
  });
  expect(outcome).toBe(false);
  expect(result.current.error).toBe(
    "The request was saved, but its photo upload failed",
  );
  vi.unstubAllGlobals();
});

it("triage, start, resolve and close invalidate the shared query key on success", async () => {
  const { result } = renderHook(() => useMaintenance("org", "building"), {
    wrapper,
  });
  const invalidate = vi.spyOn(query, "invalidateQueries");
  await act(async () => {
    await result.current.triage("req-1", "HIGH");
  });
  expect(maintenanceApi.triage).toHaveBeenCalledWith(
    "org",
    "building",
    "req-1",
    "HIGH",
    "Dispatcher confirmed rule suggestion",
  );
  expect(invalidate).toHaveBeenCalled();
  expect(result.current.busy).toBe(false);
});

it("surfaces the failure message and does not invalidate when a command rejects", async () => {
  vi.mocked(maintenanceApi.start).mockRejectedValue(new Error("Not assigned"));
  const { result } = renderHook(() => useMaintenance("org", "building"), {
    wrapper,
  });
  let outcome: boolean | undefined;
  await act(async () => {
    outcome = await result.current.start("req-1");
  });
  expect(outcome).toBe(false);
  await waitFor(() => expect(result.current.error).toBe("Not assigned"));
});
