import type { QueryClient, QueryKey } from "@tanstack/react-query";

/**
 * Applies `patch` to the cached list under `key` immediately, then runs the
 * server mutation. If the mutation fails the previous list is restored and the
 * error is rethrown so the caller can surface it. Reserved for reversible,
 * non-financial actions (e.g. deleting a draft record); the server stays
 * authoritative because callers still refetch afterwards.
 */
export async function withOptimisticList<T>(
  cache: QueryClient,
  key: QueryKey,
  patch: (rows: T[]) => T[],
  mutate: () => Promise<unknown>,
): Promise<void> {
  await cache.cancelQueries({ queryKey: key, exact: true });
  const previous = cache.getQueryData<T[]>(key);
  if (Array.isArray(previous)) cache.setQueryData<T[]>(key, patch(previous));
  try {
    await mutate();
  } catch (cause) {
    if (previous !== undefined) cache.setQueryData<T[]>(key, previous);
    throw cause;
  }
}

/** Convenience patch: drop the row with the given id. */
export const withoutId =
  <T extends { id: string }>(id: string) =>
  (rows: T[]) =>
    rows.filter((row) => row.id !== id);
