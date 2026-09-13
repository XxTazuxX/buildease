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
