import { describe, it, expect } from "vitest";
import { requestSchema, stripPhotoMetadata } from "./maintenance";

describe("requestSchema", () => {
  const valid = {
    spaceId: "11111111-1111-1111-1111-111111111111",
    categoryId: "22222222-2222-2222-2222-222222222222",
    title: "Leaking tap",
    description: "Water is dripping under the sink",
    impact: "MEDIUM",
    danger: false,
  };
  it("accepts a well-formed request", () => {
    expect(requestSchema.safeParse(valid).success).toBe(true);
  });
  it("rejects a non-uuid space or category", () => {
    expect(
      requestSchema.safeParse({ ...valid, spaceId: "not-a-uuid" }).success,
    ).toBe(false);
  });
  it("rejects an empty title or description", () => {
    expect(requestSchema.safeParse({ ...valid, title: "" }).success).toBe(
      false,
    );
    expect(requestSchema.safeParse({ ...valid, description: "" }).success).toBe(
      false,
    );
  });
  it("rejects an impact outside the known set", () => {
    expect(
      requestSchema.safeParse({ ...valid, impact: "CATASTROPHIC" }).success,
    ).toBe(false);
  });
});

describe("stripPhotoMetadata", () => {
  it("rejects file types other than jpeg, png, or webp", async () => {
    const file = new File(["data"], "note.txt", { type: "text/plain" });
    await expect(stripPhotoMetadata(file)).rejects.toThrow(
      "Choose a JPEG, PNG, or WebP photo up to 10 MB",
    );
  });
  it("rejects files larger than 10 MB", async () => {
    const oversized = new File(
      [new Uint8Array(10 * 1024 * 1024 + 1)],
      "big.png",
      {
        type: "image/png",
      },
    );
    await expect(stripPhotoMetadata(oversized)).rejects.toThrow(
      "Choose a JPEG, PNG, or WebP photo up to 10 MB",
    );
  });
});

describe("maintenanceApi endpoints", () => {
  it("saves work-order costs with POST, matching the backend mapping", async () => {
    const calls: { url: string; method: string }[] = [];
    const original = globalThis.fetch;
    globalThis.fetch = (async (
      input: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      const url = String(input);
      calls.push({ url, method: init?.method ?? "GET" });
      if (url.endsWith("/auth/csrf"))
        return new Response(JSON.stringify({ token: "t" }));
      return new Response("");
    }) as typeof fetch;
    try {
      const { maintenanceApi } = await import("./maintenance");
      await maintenanceApi.updateWorkCosts("o", "b", "w", { actualCost: 10 });
    } finally {
      globalThis.fetch = original;
    }
    expect(calls.at(-1)).toEqual({
      url: "/api/organizations/o/buildings/b/maintenance/work-orders/w/costs",
      method: "POST",
    });
  });
});

describe("recurringPlanSchema", () => {
  it("requires a positive interval and an ISO date", async () => {
    const { recurringPlanSchema } = await import("./maintenance");
    const plan = {
      spaceId: "11111111-1111-1111-1111-111111111111",
      categoryId: "22222222-2222-2222-2222-222222222222",
      title: "Boiler service",
      description: "Annual service",
      intervalDays: 365,
      nextRunOn: "2026-01-31",
    };
    expect(recurringPlanSchema.safeParse(plan).success).toBe(true);
    expect(
      recurringPlanSchema.safeParse({ ...plan, intervalDays: 0 }).success,
    ).toBe(false);
    expect(
      recurringPlanSchema.safeParse({ ...plan, nextRunOn: "31/01/2026" })
        .success,
    ).toBe(false);
  });
});
