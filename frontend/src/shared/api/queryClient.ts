import { QueryCache, QueryClient } from "@tanstack/react-query";
import { errorMessage } from "@/shared/feedback/reportError";
import { notify } from "@/shared/feedback/notify";

/**
 * Query client for the app. A failed first load is shown inline by the view (QueryError); a failed
 * background refresh would otherwise be silent, so only that case raises a toast.
 */
export function createQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        if (query.state.data === undefined) return;
        if (typeof navigator !== "undefined" && !navigator.onLine) return;
        notify.error(
          `Could not refresh this page: ${errorMessage(error, "request failed")}`,
        );
      },
    }),
    defaultOptions: { queries: { retry: false, staleTime: 15000 } },
  });
}
