import { beforeEach, expect, it, vi } from "vitest";
import { notify } from "@/shared/feedback/notify";
import { createQueryClient } from "./queryClient";

beforeEach(() => notify.clear());

const fetchWith = (
  client: ReturnType<typeof createQueryClient>,
  fn: () => unknown,
) =>
  client
    .fetchQuery({
      queryKey: ["probe"],
      queryFn: fn as () => Promise<unknown>,
      staleTime: 0,
    })
    .catch(() => undefined);

it("stays silent when the first load fails, because the view shows it inline", async () => {
  const client = createQueryClient();
  await fetchWith(client, () => Promise.reject(new Error("Boom")));
  expect(notify.snapshot()).toEqual([]);
});

it("raises a toast when a refresh of already-loaded data fails", async () => {
  const client = createQueryClient();
  client.setQueryData(["probe"], ["cached"]);
  await fetchWith(client, () => Promise.reject(new Error("Server down")));
  expect(notify.snapshot()).toMatchObject([
    { kind: "error", message: "Could not refresh this page: Server down" },
  ]);
});

it("does not toast while the browser is offline", async () => {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
  const client = createQueryClient();
  client.setQueryData(["probe"], ["cached"]);
  await fetchWith(client, () => Promise.reject(new Error("Network")));
  expect(notify.snapshot()).toEqual([]);
  vi.restoreAllMocks();
});
