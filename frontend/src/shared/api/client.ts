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

// Impersonation keeps a fully separate, in-memory-only token pair. It never touches the
// cookie-based refresh flow above, which is shared browser-wide via navigator.locks — reusing it
// here would leak an admin's impersonated session into their other open tabs on silent refresh.
let impersonationAccessToken: string | null = null;
let impersonationRefreshToken: string | null = null;
let impersonationRefreshing: Promise<void> | null = null;
export const isImpersonating = () => impersonationAccessToken !== null;
export const beginImpersonation = (tokens: {
  accessToken: string;
  refreshToken: string;
}) => {
  impersonationAccessToken = tokens.accessToken;
  impersonationRefreshToken = tokens.refreshToken;
};
export const exitImpersonation = async () => {
  try {
    if (impersonationAccessToken) await api("/impersonation/exit", "POST");
  } finally {
    impersonationAccessToken = null;
    impersonationRefreshToken = null;
  }
};
async function refreshImpersonation(): Promise<void> {
  if (!impersonationRefreshing) {
    impersonationRefreshing = request<{
      accessToken: string;
      refreshToken: string;
    }>(
      "/impersonation/refresh",
      "POST",
      { refreshToken: impersonationRefreshToken },
      false,
    )
      .then((tokens) => {
        impersonationAccessToken = tokens.accessToken;
        impersonationRefreshToken = tokens.refreshToken;
      })
      .finally(() => {
        impersonationRefreshing = null;
      });
  }
  return impersonationRefreshing;
}
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
  const token = impersonationAccessToken ?? accessToken;
  if (bearer && token) headers.Authorization = `Bearer ${token}`;
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
      if (impersonationAccessToken) await refreshImpersonation();
      else await refresh();
      return await request<T>(path, method, body, true);
    } catch (retryError) {
      if (retryError instanceof ApiError && retryError.status === 401) {
        if (impersonationAccessToken) {
          impersonationAccessToken = null;
          impersonationRefreshToken = null;
        } else {
          clearToken();
          unauthorized();
        }
      }
      throw retryError;
    }
  }
}
export function publicApi<T>(path: string, method = "GET", body?: unknown) {
  return request<T>(path, method, body, false);
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
