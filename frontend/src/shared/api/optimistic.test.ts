import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { withOptimisticList, withoutId } from "./optimistic";

type Row = { id: string };
const key = ["org", "things"];

function seeded() {
  const cache = new QueryClient();
  cache.setQueryData<Row[]>(key, [{ id: "a" }, { id: "b" }]);
  return cache;
}

describe("withOptimisticList", () => {
  it("shows the change before the server answers", async () => {
    const cache = seeded();
    let seen: Row[] | undefined;
    await withOptimisticList<Row>(cache, key, withoutId("a"), async () => {
      seen = cache.getQueryData<Row[]>(key);
    });
    expect(seen).toEqual([{ id: "b" }]);
  });

  it("restores the previous list and rethrows when the mutation fails", async () => {
    const cache = seeded();
    await expect(
      withOptimisticList<Row>(cache, key, withoutId("a"), async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(cache.getQueryData<Row[]>(key)).toEqual([{ id: "a" }, { id: "b" }]);
  });

  it("just runs the mutation when nothing is cached", async () => {
    const cache = new QueryClient();
    let ran = false;
    await withOptimisticList<Row>(cache, key, withoutId("a"), async () => {
      ran = true;
    });
    expect(ran).toBe(true);
    expect(cache.getQueryData(key)).toBeUndefined();
  });
});
