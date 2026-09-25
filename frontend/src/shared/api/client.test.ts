import { beforeEach, afterEach, it, expect, vi } from "vitest";
beforeEach(() => {
  vi.resetModules();
});
afterEach(() => {
  vi.unstubAllGlobals();
});
it("single-flights refresh and never stores access tokens in browser storage", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ token: "csrf" })))
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          accessToken: "memory-only",
          mustChangePassword: false,
        }),
      ),
    );
  vi.stubGlobal("fetch", fetch);
  const client = await import("./client");
  await Promise.all([client.refresh(), client.refresh(), client.refresh()]);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(localStorage.length).toBe(0);
  expect(sessionStorage.length).toBe(0);
});
it("retries an expired access request once after refresh", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response("{}", { status: 401 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ token: "csrf" })))
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({ accessToken: "new", mustChangePassword: false }),
      ),
    )
    .mockResolvedValueOnce(new Response(JSON.stringify([{ id: "one" }])));
  vi.stubGlobal("fetch", fetch);
  const client = await import("./client");
  expect(await client.api("/platform/organizations")).toEqual([{ id: "one" }]);
  expect(fetch).toHaveBeenCalledTimes(4);
  expect(fetch.mock.calls[3][1].headers.Authorization).toBe("Bearer new");
});
it("does not loop if retried request remains unauthorized", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response("{}", { status: 401 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ token: "csrf" })))
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({ accessToken: "new", mustChangePassword: false }),
      ),
    )
    .mockResolvedValueOnce(new Response("{}", { status: 401 }));
  vi.stubGlobal("fetch", fetch);
  const client = await import("./client");
  const lost = vi.fn();
  client.setUnauthorized(lost);
  await expect(client.api("/platform/accounts")).rejects.toThrow();
  expect(fetch).toHaveBeenCalledTimes(4);
  expect(lost).toHaveBeenCalledOnce();
});
it("uses the impersonation token instead of the admin's once impersonation begins", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ token: "csrf" })))
    .mockResolvedValueOnce(new Response(JSON.stringify([{ id: "one" }])));
  vi.stubGlobal("fetch", fetch);
  const client = await import("./client");
  client.storeTokens({ accessToken: "admin-token", mustChangePassword: false });
  client.beginImpersonation({
    accessToken: "impersonation-token",
    refreshToken: "impersonation-refresh",
  });
  expect(client.isImpersonating()).toBe(true);
  await client.api("/platform/organizations", "POST", {});
  expect(fetch.mock.calls[1][1].headers.Authorization).toBe(
    "Bearer impersonation-token",
  );
});
it("a 401 while impersonating refreshes via /impersonation/refresh, not /auth/refresh", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response("{}", { status: 401 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ token: "csrf" })))
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          accessToken: "rotated-access",
          refreshToken: "rotated-refresh",
        }),
      ),
    )
    .mockResolvedValueOnce(new Response(JSON.stringify([{ id: "one" }])));
  vi.stubGlobal("fetch", fetch);
  const client = await import("./client");
  client.beginImpersonation({
    accessToken: "expired",
    refreshToken: "impersonation-refresh",
  });
  await client.api("/platform/audit");
  expect(fetch.mock.calls[2][0]).toBe("/api/impersonation/refresh");
  expect(fetch.mock.calls[3][1].headers.Authorization).toBe(
    "Bearer rotated-access",
  );
});
it("exitImpersonation clears impersonation state even when the network call fails", async () => {
  const fetch = vi.fn().mockRejectedValueOnce(new Error("offline"));
  vi.stubGlobal("fetch", fetch);
  const client = await import("./client");
  client.beginImpersonation({
    accessToken: "token",
    refreshToken: "refresh",
  });
  await expect(client.exitImpersonation()).rejects.toThrow();
  expect(client.isImpersonating()).toBe(false);
});
it("renews CSRF after authentication clears the old cookie", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ token: "before" })))
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({ accessToken: "one", mustChangePassword: true }),
      ),
    )
    .mockResolvedValueOnce(new Response(JSON.stringify({ token: "after" })))
    .mockResolvedValueOnce(new Response("", { status: 200 }));
  vi.stubGlobal("fetch", fetch);
  const client = await import("./client");
  await client.login("user@example.test", "private password");
  await client.api("/auth/change-password", "POST", {
    oldPassword: "old",
    newPassword: "new",
  });
  expect(fetch.mock.calls[3][1].headers["X-XSRF-TOKEN"]).toBe("after");
});
it("downloadFile attaches the bearer token and triggers a browser download", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ token: "csrf" })))
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          accessToken: "memory-only",
          mustChangePassword: false,
        }),
      ),
    )
    .mockResolvedValueOnce(
      new Response(new Blob(["a,b\n1,2"], { type: "text/csv" })),
    );
  vi.stubGlobal("fetch", fetch);
  const createObjectURL = vi
    .fn()
    .mockReturnValue("blob:mock-url") as typeof URL.createObjectURL;
  const revokeObjectURL = vi.fn() as typeof URL.revokeObjectURL;
  URL.createObjectURL = createObjectURL;
  URL.revokeObjectURL = revokeObjectURL;
  const click = vi
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(() => {});
  const client = await import("./client");
  await client.refresh();
  await client.downloadFile("/reports/rent-roll/export", "rent-roll.csv");
  expect(fetch.mock.calls[2][1].headers.Authorization).toBe(
    "Bearer memory-only",
  );
  expect(createObjectURL).toHaveBeenCalled();
  expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
  click.mockRestore();
});
it("downloadFile throws an ApiError on a failed response without downloading", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "Forbidden" }), { status: 403 }),
    );
  vi.stubGlobal("fetch", fetch);
  const createObjectURL = vi.fn() as typeof URL.createObjectURL;
  URL.createObjectURL = createObjectURL;
  URL.revokeObjectURL = vi.fn();
  const client = await import("./client");
  await expect(
    client.downloadFile("/reports/rent-roll/export", "rent-roll.csv"),
  ).rejects.toThrow("Forbidden");
  expect(createObjectURL).not.toHaveBeenCalled();
});
