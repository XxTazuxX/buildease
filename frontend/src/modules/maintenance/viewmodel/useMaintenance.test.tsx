import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode } from "react";
import { beforeEach, it, expect, vi } from "vitest";
import {
  useMaintenance,
  useRecurringPlans,
  useRequestDetail,
} from "./useMaintenance";
import { maintenanceApi, stripPhotoMetadata } from "../model/maintenance";

vi.mock("../model/maintenance", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../model/maintenance")>();
  return {
    ...actual,
    maintenanceApi: {
      categories: vi.fn().mockResolvedValue([]),
      requests: vi.fn().mockResolvedValue([]),
      detail: vi.fn(),
      submit: vi.fn(),
      comment: vi.fn().mockResolvedValue({ id: "comment-1" }),
      triage: vi.fn().mockResolvedValue(undefined),
      start: vi.fn().mockResolvedValue(undefined),
      resolve: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      createCategory: vi.fn().mockResolvedValue(undefined),
      updateCategory: vi.fn().mockResolvedValue(undefined),
      preparePhoto: vi.fn(),
      vendors: vi.fn().mockResolvedValue([]),
      createVendor: vi.fn().mockResolvedValue(undefined),
      updateVendor: vi.fn().mockResolvedValue(undefined),
      deleteVendor: vi.fn().mockResolvedValue(undefined),
      deleteCategory: vi.fn().mockResolvedValue(undefined),
      recurringPlans: vi.fn().mockResolvedValue([]),
      createRecurringPlan: vi.fn().mockResolvedValue(undefined),
      updateRecurringPlan: vi.fn().mockResolvedValue(undefined),
      deleteRecurringPlan: vi.fn().mockResolvedValue(undefined),
      assignStaff: vi.fn().mockResolvedValue(undefined),
      assignVendor: vi.fn().mockResolvedValue(undefined),
      addWorkLog: vi.fn().mockResolvedValue(undefined),
      updateWorkCosts: vi.fn().mockResolvedValue(undefined),
      downloadPhoto: vi.fn(),
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

it("updateCategory calls the api with the category id and invalidates on success", async () => {
  const { result } = renderHook(() => useMaintenance("org", "building"), {
    wrapper,
  });
  const invalidate = vi.spyOn(query, "invalidateQueries");
  const body = {
    name: "Plumbing & Water",
    responseHours: 2,
    resolutionHours: 24,
  };
  let outcome: boolean | undefined;
  await act(async () => {
    outcome = await result.current.updateCategory("cat-1", body);
  });
  expect(outcome).toBe(true);
  expect(maintenanceApi.updateCategory).toHaveBeenCalledWith(
    "org",
    "building",
    "cat-1",
    body,
  );
  expect(invalidate).toHaveBeenCalled();
});

it("deletes a category and reports why it was refused", async () => {
  const { result } = renderHook(() => useMaintenance("org", "building"), {
    wrapper,
  });
  await act(async () => {
    expect(await result.current.deleteCategory("cat-1")).toBe(true);
  });
  expect(maintenanceApi.deleteCategory).toHaveBeenCalledWith(
    "org",
    "building",
    "cat-1",
  );

  vi.mocked(maintenanceApi.deleteCategory).mockRejectedValueOnce(
    new Error("Maintenance requests use this category"),
  );
  await act(async () => {
    expect(await result.current.deleteCategory("cat-2")).toBe(false);
  });
  expect(result.current.error).toBe("Maintenance requests use this category");
});

it("edits and deletes a vendor through the right endpoints", async () => {
  const invalidate = vi.fn();
  const { result } = renderHook(() => useMaintenance("org", "building"), {
    wrapper,
  });
  vi.spyOn(query, "invalidateQueries").mockImplementation(invalidate as never);
  await act(async () => {
    await result.current.updateVendor("vendor-1", {
      name: "Glass & Co",
      email: "glass@example.test",
    });
    await result.current.deleteVendor("vendor-1");
  });
  expect(maintenanceApi.updateVendor).toHaveBeenCalledWith(
    "org",
    "building",
    "vendor-1",
    { name: "Glass & Co", email: "glass@example.test" },
  );
  expect(maintenanceApi.deleteVendor).toHaveBeenCalledWith(
    "org",
    "building",
    "vendor-1",
  );
  expect(invalidate).toHaveBeenCalledTimes(2);
});

it("useRecurringPlans validates, edits and deletes plans", async () => {
  const { result } = renderHook(() => useRecurringPlans("org", "building"), {
    wrapper,
  });
  const plan = {
    spaceId: "11111111-1111-1111-1111-111111111111",
    categoryId: "22222222-2222-2222-2222-222222222222",
    title: "Boiler service",
    description: "Annual service",
    intervalDays: 365,
    nextRunOn: "2026-06-01",
  };
  await act(async () => {
    expect(await result.current.update("plan-1", plan)).toBe(true);
  });
  expect(maintenanceApi.updateRecurringPlan).toHaveBeenCalledWith(
    "org",
    "building",
    "plan-1",
    plan,
  );

  await act(async () => {
    expect(
      await result.current.update("plan-1", { ...plan, intervalDays: 0 }),
    ).toBe(false);
  });
  expect(maintenanceApi.updateRecurringPlan).toHaveBeenCalledTimes(1);

  await act(async () => {
    expect(await result.current.remove("plan-1")).toBe(true);
  });
  expect(maintenanceApi.deleteRecurringPlan).toHaveBeenCalledWith(
    "org",
    "building",
    "plan-1",
  );
});

it("useRequestDetail fetches the request and invalidates it after commenting", async () => {
  vi.mocked(maintenanceApi.detail).mockResolvedValue({
    id: "req-1",
    space_id: "space-1",
    category_id: "cat-1",
    title: "Leaking tap",
    impact: "MEDIUM",
    danger: false,
    suggested_priority: "MEDIUM",
    priority: "MEDIUM",
    status: "SUBMITTED",
    response_due_at: null,
    resolution_due_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    comments: [],
    history: [],
    work_orders: [],
    work_logs: [],
    photos: [],
    description: "Water is dripping",
    created_by: "account-1",
    resolution_summary: null,
  });
  const { result } = renderHook(
    () => useRequestDetail("org", "building", "req-1"),
    { wrapper },
  );
  await waitFor(() => expect(result.current.query.data?.id).toBe("req-1"));
  const invalidate = vi.spyOn(query, "invalidateQueries");
  await act(async () => {
    await result.current.comment("Any update?");
  });
  expect(maintenanceApi.comment).toHaveBeenCalledWith(
    "org",
    "building",
    "req-1",
    "Any update?",
    false,
  );
  expect(invalidate).toHaveBeenCalled();
});

it("useMaintenance assigns staff and vendors, and can create a vendor", async () => {
  const { result } = renderHook(() => useMaintenance("org", "building"), {
    wrapper,
  });
  await act(async () => {
    await result.current.assignStaff("req-1", "account-1", 50);
  });
  expect(maintenanceApi.assignStaff).toHaveBeenCalledWith(
    "org",
    "building",
    "req-1",
    "account-1",
    50,
  );

  await act(async () => {
    await result.current.assignVendor("req-1", "vendor-1", 75);
  });
  expect(maintenanceApi.assignVendor).toHaveBeenCalledWith(
    "org",
    "building",
    "req-1",
    "vendor-1",
    75,
  );

  await act(async () => {
    await result.current.createVendor({ name: "Acme Plumbing" });
  });
  expect(maintenanceApi.createVendor).toHaveBeenCalledWith("org", "building", {
    name: "Acme Plumbing",
  });
});

it("useRequestDetail adds a work log and updates work costs", async () => {
  vi.mocked(maintenanceApi.detail).mockResolvedValue({
    id: "req-1",
    space_id: "space-1",
    category_id: "cat-1",
    title: "Leaking tap",
    impact: "MEDIUM",
    danger: false,
    suggested_priority: "MEDIUM",
    priority: "MEDIUM",
    status: "IN_PROGRESS",
    response_due_at: null,
    resolution_due_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    comments: [],
    history: [],
    work_orders: [],
    work_logs: [],
    photos: [],
    description: "Water is dripping",
    created_by: "account-1",
    resolution_summary: null,
  });
  const { result } = renderHook(
    () => useRequestDetail("org", "building", "req-1"),
    { wrapper },
  );
  await waitFor(() => expect(result.current.query.data?.id).toBe("req-1"));

  await act(async () => {
    await result.current.addWorkLog("work-1", "Replaced washer", 30);
  });
  expect(maintenanceApi.addWorkLog).toHaveBeenCalledWith(
    "org",
    "building",
    "work-1",
    "Replaced washer",
    30,
  );

  await act(async () => {
    await result.current.updateWorkCosts("work-1", { actualCost: 45 });
  });
  expect(maintenanceApi.updateWorkCosts).toHaveBeenCalledWith(
    "org",
    "building",
    "work-1",
    { actualCost: 45 },
  );
});
