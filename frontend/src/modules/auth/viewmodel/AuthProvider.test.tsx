import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { type ReactNode } from "react";
import { beforeEach, it, expect, vi } from "vitest";
import { AuthProvider, useAuth } from "./AuthProvider";
import * as client from "@/shared/api/client";
import * as model from "../model/auth";
vi.mock("@/shared/api/client", () => ({
  refresh: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  clearToken: vi.fn(),
  setUnauthorized: vi.fn(),
  beginImpersonation: vi.fn(),
  exitImpersonation: vi.fn(),
}));
vi.mock("../model/auth", () => ({
  getProfile: vi.fn(),
  changePassword: vi.fn(),
}));
const profile = {
  id: "one",
  display_name: "Alex",
  email: "alex@example.test",
  platform_admin: false,
  must_change_password: false,
  memberships: [],
};
let query: QueryClient;
beforeEach(() => {
  vi.resetAllMocks();
  query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.mocked(client.refresh).mockRejectedValue(new Error("No session"));
  vi.mocked(model.getProfile).mockResolvedValue(profile);
});
function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={query}>
      <MemoryRouter>
        <AuthProvider>{children}</AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}
it("restores a refresh session and loads the safe profile", async () => {
  vi.mocked(client.refresh).mockResolvedValue({
    accessToken: "memory",
    mustChangePassword: false,
  });
  const { result } = renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(result.current.ready).toBe(true));
  expect(result.current.profile).toEqual(profile);
});
it("restricts temporary credentials and clears cached data after password replacement", async () => {
  const { result } = renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(result.current.ready).toBe(true));
  query.setQueryData(["old-org"], { private: true });
  vi.mocked(client.login).mockResolvedValue({
    accessToken: "temporary",
    mustChangePassword: true,
  });
  await act(async () =>
    result.current.signIn("alex@example.test", "temporary"),
  );
  expect(result.current.mustChange).toBe(true);
  expect(model.getProfile).not.toHaveBeenCalled();
  expect(query.getQueryData(["old-org"])).toBeUndefined();
  await act(async () => result.current.change("temporary", "permanent"));
  expect(model.changePassword).toHaveBeenCalledWith("temporary", "permanent");
  expect(result.current.mustChange).toBe(false);
  expect(result.current.profile).toBeNull();
});
it("startImpersonation stashes the admin profile and swaps to the target's", async () => {
  const admin = { ...profile, platform_admin: true };
  const target = {
    ...profile,
    id: "two",
    display_name: "Target",
    email: "target@example.test",
  };
  vi.mocked(client.refresh).mockResolvedValue({
    accessToken: "memory",
    mustChangePassword: false,
  });
  vi.mocked(model.getProfile).mockResolvedValueOnce(admin);
  const { result } = renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(result.current.ready).toBe(true));
  expect(result.current.profile).toEqual(admin);

  vi.mocked(model.getProfile).mockResolvedValueOnce(target);
  await act(async () =>
    result.current.startImpersonation({
      accessToken: "imp-access",
      refreshToken: "imp-refresh",
      targetEmail: target.email,
      targetDisplayName: target.display_name,
    }),
  );
  expect(client.beginImpersonation).toHaveBeenCalledWith({
    accessToken: "imp-access",
    refreshToken: "imp-refresh",
  });
  expect(result.current.profile).toEqual(target);
  expect(result.current.impersonating).toBe(true);
  expect(result.current.impersonationTarget).toEqual({
    email: target.email,
    displayName: target.display_name,
  });
});
it("exitImpersonation restores the stashed admin profile without another /auth/me call", async () => {
  const admin = { ...profile, platform_admin: true };
  const target = { ...profile, id: "two", display_name: "Target" };
  vi.mocked(client.refresh).mockResolvedValue({
    accessToken: "memory",
    mustChangePassword: false,
  });
  vi.mocked(model.getProfile).mockResolvedValueOnce(admin);
  const { result } = renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(result.current.ready).toBe(true));
  vi.mocked(model.getProfile).mockResolvedValueOnce(target);
  await act(async () =>
    result.current.startImpersonation({
      accessToken: "imp-access",
      refreshToken: "imp-refresh",
      targetEmail: target.email,
      targetDisplayName: target.display_name,
    }),
  );
  const callsAfterStart = vi.mocked(model.getProfile).mock.calls.length;

  await act(async () => result.current.exitImpersonation());
  expect(client.exitImpersonation).toHaveBeenCalled();
  expect(result.current.profile).toEqual(admin);
  expect(result.current.impersonating).toBe(false);
  expect(model.getProfile).toHaveBeenCalledTimes(callsAfterStart);
});
it("loads profile on login and removes all query data on logout", async () => {
  const { result } = renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(result.current.ready).toBe(true));
  vi.mocked(client.login).mockResolvedValue({
    accessToken: "memory",
    mustChangePassword: false,
  });
  await act(async () => result.current.signIn("alex@example.test", "password"));
  expect(result.current.profile).toEqual(profile);
  query.setQueryData(["organization"], { private: true });
  await act(async () => result.current.signOut());
  expect(client.logout).toHaveBeenCalled();
  expect(result.current.profile).toBeNull();
  expect(query.getQueryData(["organization"])).toBeUndefined();
});
