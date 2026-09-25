import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode } from "react";
import { beforeEach, it, expect, vi } from "vitest";
import { useAccountingSync, useApiKeys } from "./useIntegrations";
import { accountingApi, apiKeysApi } from "../model/integrations";

vi.mock("../model/integrations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../model/integrations")>();
  return {
    ...actual,
    apiKeysApi: {
      list: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      revoke: vi.fn().mockResolvedValue(undefined),
    },
    accountingApi: {
      sync: vi.fn().mockResolvedValue({ id: "sync-1" }),
      history: vi.fn().mockResolvedValue([]),
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

it("creates a key with a valid name and returns the plaintext key once", async () => {
  vi.mocked(apiKeysApi.create).mockResolvedValue({
    id: "key-1",
    key: "plain-text-key",
  });
  const invalidate = vi.spyOn(query, "invalidateQueries");
  const { result } = renderHook(() => useApiKeys("org"), { wrapper });
  let created: { id: string; key: string } | null | undefined;
  await act(async () => {
    created = await result.current.create("Accounting sync");
  });
  expect(created).toEqual({ id: "key-1", key: "plain-text-key" });
  expect(apiKeysApi.create).toHaveBeenCalledWith("org", "Accounting sync");
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ["org", "api-keys"] });
});

it("rejects a blank name before calling the API", async () => {
  const { result } = renderHook(() => useApiKeys("org"), { wrapper });
  let created: { id: string; key: string } | null | undefined;
  await act(async () => {
    created = await result.current.create("");
  });
  expect(created).toBeNull();
  expect(apiKeysApi.create).not.toHaveBeenCalled();
  await waitFor(() => expect(result.current.error).not.toBe(""));
});

it("revokes a key and invalidates the list", async () => {
  const invalidate = vi.spyOn(query, "invalidateQueries");
  const { result } = renderHook(() => useApiKeys("org"), { wrapper });
  await act(async () => {
    await result.current.revoke("key-1");
  });
  expect(apiKeysApi.revoke).toHaveBeenCalledWith("org", "key-1");
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ["org", "api-keys"] });
});

it("triggers an accounting sync and invalidates the history", async () => {
  const invalidate = vi.spyOn(query, "invalidateQueries");
  const { result } = renderHook(() => useAccountingSync("org", "building"), {
    wrapper,
  });
  let outcome: boolean | undefined;
  await act(async () => {
    outcome = await result.current.sync();
  });
  expect(outcome).toBe(true);
  expect(accountingApi.sync).toHaveBeenCalledWith("org", "building");
  expect(invalidate).toHaveBeenCalledWith({
    queryKey: ["org", "building", "building", "accounting-syncs"],
  });
});
