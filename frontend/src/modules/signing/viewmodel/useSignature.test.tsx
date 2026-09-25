import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode } from "react";
import { beforeEach, it, expect, vi } from "vitest";
import { useSignature } from "./useSignature";
import { signaturesApi } from "../model/signatures";

vi.mock("../model/signatures", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../model/signatures")>();
  return {
    ...actual,
    signaturesApi: {
      status: vi.fn().mockResolvedValue({
        owner: null,
        resident: null,
        fullyExecuted: false,
      }),
      sign: vi.fn(),
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

it("signs with the typed method and invalidates the status query", async () => {
  vi.mocked(signaturesApi.sign).mockResolvedValue(undefined);
  const invalidate = vi.spyOn(query, "invalidateQueries");
  const { result } = renderHook(
    () => useSignature("org", "building", "lease-1"),
    { wrapper },
  );
  let outcome: boolean | undefined;
  await act(async () => {
    outcome = await result.current.sign("OWNER", "Owner Name");
  });
  expect(outcome).toBe(true);
  expect(signaturesApi.sign).toHaveBeenCalledWith(
    "org",
    "building",
    "lease-1",
    {
      role: "OWNER",
      signedName: "Owner Name",
      method: "TYPED",
    },
  );
  expect(invalidate).toHaveBeenCalledWith({
    queryKey: ["org", "building", "building", "leases", "lease-1", "signature"],
  });
});

it("surfaces an error when signing fails", async () => {
  vi.mocked(signaturesApi.sign).mockRejectedValue(new Error("Forbidden"));
  const { result } = renderHook(
    () => useSignature("org", "building", "lease-1"),
    { wrapper },
  );
  let outcome: boolean | undefined;
  await act(async () => {
    outcome = await result.current.sign("OWNER", "Owner Name");
  });
  expect(outcome).toBe(false);
  expect(result.current.error).toBe("Forbidden");
});
