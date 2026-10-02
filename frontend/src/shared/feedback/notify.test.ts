import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { notify } from "./notify";

beforeEach(() => {
  vi.useFakeTimers();
  notify.clear();
});
afterEach(() => vi.useRealTimers());

describe("notify", () => {
  it("queues toasts of each kind in order", () => {
    notify.error("Failed");
    notify.success("Saved");
    expect(
      notify.snapshot().map((toast) => [toast.kind, toast.message]),
    ).toEqual([
      ["error", "Failed"],
      ["success", "Saved"],
    ]);
  });

  it("drops an identical toast raised again within the duplicate window", () => {
    notify.error("Failed");
    notify.error("Failed");
    expect(notify.snapshot()).toHaveLength(1);
    vi.advanceTimersByTime(4001);
    notify.error("Failed");
    expect(notify.snapshot()).toHaveLength(2);
  });

  it("treats the same message with a different kind as distinct", () => {
    notify.error("Done");
    notify.success("Done");
    expect(notify.snapshot()).toHaveLength(2);
  });

  it("keeps only the three most recent toasts", () => {
    ["a", "b", "c", "d"].forEach((message) => notify.info(message));
    expect(notify.snapshot().map((toast) => toast.message)).toEqual([
      "b",
      "c",
      "d",
    ]);
  });

  it("dismisses one toast and notifies subscribers of every change", () => {
    const listener = vi.fn();
    const unsubscribe = notify.subscribe(listener);
    notify.warning("Careful");
    const [toast] = notify.snapshot();
    notify.dismiss(toast.id);
    expect(notify.snapshot()).toEqual([]);
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    notify.info("Later");
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
