export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export interface Tokens {
  accessToken: string;
  mustChangePassword: boolean;
}
let accessToken: string | null = null;
let refreshing: Promise<Tokens> | null = null;
let unauthorized: () => void = () => {};
export const setUnauthorized = (handler: () => void) => {
  unauthorized = handler;
};
export const clearToken = () => {
  accessToken = null;
};
export const storeTokens = (tokens: Tokens) => {
  accessToken = tokens.accessToken;
};
async function csrf(): Promise<string> {
  // Authentication/password changes may clear Spring's CSRF cookie.
  const response = await fetch("/api/auth/csrf", {
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!response.ok)
    throw new ApiError(
      response.status,
      "Could not initialize a secure request",
    );
  return ((await response.json()) as { token: string }).token;
}
async function request<T>(
  path: string,
  method: string,
  body: unknown,
  bearer: boolean,
): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (method !== "GET") headers["X-XSRF-TOKEN"] = await csrf();
  if (bearer && accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const response = await fetch(`/api${path}`, {
    method,
    headers,
    credentials: "same-origin",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const data = (await response
      .json()
      .catch(() => ({ message: "Request failed" }))) as { message?: string };
    throw new ApiError(response.status, data.message || "Request failed");
  }
  const text = await response.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}
export function refresh(): Promise<Tokens> {
  if (!refreshing) {
    const run = () =>
      request<Tokens>("/auth/refresh", "POST", undefined, false);
    // Browser-wide locking ensures each tab rotates the newest cookie, never a stale token.
    refreshing = (
      typeof navigator !== "undefined" && navigator.locks
        ? navigator.locks.request("buildease-refresh", run)
        : run()
    )
      .then((tokens) => {
        storeTokens(tokens);
        return tokens;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  try {
    return await request<T>(path, method, body, true);
  } catch (error) {
    if (
      !(error instanceof ApiError) ||
      error.status !== 401 ||
      ["/auth/login", "/auth/refresh", "/auth/logout"].includes(path)
    )
      throw error;
    try {
      await refresh();
      return await request<T>(path, method, body, true);
    } catch (retryError) {
      if (retryError instanceof ApiError && retryError.status === 401) {
        clearToken();
        unauthorized();
      }
      throw retryError;
    }
  }
}
export async function login(email: string, password: string) {
  const tokens = await request<Tokens>(
    "/auth/login",
    "POST",
    { email, password },
    false,
  );
  storeTokens(tokens);
  return tokens;
}
export async function logout() {
  try {
    await request("/auth/logout", "POST", undefined, false);
  } finally {
    clearToken();
  }
}
