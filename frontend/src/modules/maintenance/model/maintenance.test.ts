import { describe, it, expect } from "vitest";
import {
  assignmentFormSchema,
  categoryFormSchema,
  commentFormSchema,
  photoProblem,
  recurringPlanFormSchema,
  requestSchema,
  stripPhotoMetadata,
  vendorFormSchema,
  workCostFormSchema,
  workLogFormSchema,
} from "./maintenance";

describe("maintenance form schemas", () => {
  it("applies the category name and hour limits and ordering", () => {
    const ok = { name: "HVAC", responseHours: "4", resolutionHours: "48" };
    expect(categoryFormSchema.parse(ok)).toEqual({
      name: "HVAC",
      responseHours: 4,
      resolutionHours: 48,
    });
    const fails = (patch: object) =>
      !categoryFormSchema.safeParse({ ...ok, ...patch }).success;
    expect(fails({ name: "n".repeat(121) })).toBe(true);
    expect(fails({ responseHours: "0" })).toBe(true);
    expect(fails({ responseHours: "8761" })).toBe(true);
    expect(fails({ resolutionHours: "87601" })).toBe(true);
    expect(fails({ responseHours: "10", resolutionHours: "9" })).toBe(true);
    expect(fails({ responseHours: "10", resolutionHours: "10" })).toBe(false);
  });

  it("requires a vendor or staff member depending on the assignment target", () => {
    const base = { vendorId: "", accountId: "", estimate: "" };
    expect(
      assignmentFormSchema.safeParse({ ...base, target: "vendor" }).success,
    ).toBe(false);
    expect(
      assignmentFormSchema.safeParse({
        ...base,
        target: "vendor",
        vendorId: "v1",
      }).success,
    ).toBe(true);
    expect(
      assignmentFormSchema.safeParse({ ...base, target: "staff" }).success,
    ).toBe(false);
    expect(
      assignmentFormSchema.parse({
        ...base,
        target: "staff",
        accountId: "a1",
        estimate: "12.5",
      }).estimate,
    ).toBe(12.5);
  });

  it("validates vendor email, phone and the linked account UUID", () => {
    const ok = { name: "Acme", email: "", phone: "", accountId: "" };
    expect(vendorFormSchema.safeParse(ok).success).toBe(true);
    const fails = (patch: object) =>
      !vendorFormSchema.safeParse({ ...ok, ...patch }).success;
    expect(fails({ name: "" })).toBe(true);
    expect(fails({ name: "n".repeat(161) })).toBe(true);
    expect(fails({ email: "nope" })).toBe(true);
    expect(fails({ phone: "1".repeat(41) })).toBe(true);
    expect(fails({ accountId: "not-a-uuid" })).toBe(true);
    expect(
      fails({ accountId: "11111111-1111-4111-8111-111111111111" }),
    ).toBe(false);
  });

  it("limits comments, work notes, minutes and costs", () => {
    expect(
      commentFormSchema.safeParse({ body: "c".repeat(2001), internal: false })
        .success,
    ).toBe(false);
    expect(workLogFormSchema.parse({ note: "ok", minutes: "" }).minutes).toBe(
      undefined,
    );
    for (const minutes of ["0", "1441", "1.5"])
      expect(workLogFormSchema.safeParse({ note: "ok", minutes }).success).toBe(
        false,
      );
    expect(workCostFormSchema.parse({ actualCost: "0" }).actualCost).toBe(0);
    expect(workCostFormSchema.safeParse({ actualCost: "" }).success).toBe(false);
    expect(workCostFormSchema.safeParse({ actualCost: "-1" }).success).toBe(
      false,
    );
  });

  it("validates a recurring plan form and turns the interval into a number", () => {
    const ok = {
      spaceId: "s",
      categoryId: "c",
      title: "Boiler",
      description: "Service",
      intervalDays: "365",
      nextRunOn: "2026-02-01",
    };
    expect(recurringPlanFormSchema.parse(ok).intervalDays).toBe(365);
    const fails = (patch: object) =>
      !recurringPlanFormSchema.safeParse({ ...ok, ...patch }).success;
    expect(fails({ intervalDays: "0" })).toBe(true);
    expect(fails({ intervalDays: "3651" })).toBe(true);
    expect(fails({ nextRunOn: "" })).toBe(true);
    expect(fails({ description: "d".repeat(2001) })).toBe(true);
  });
});

describe("photoProblem", () => {
  it("accepts JPEG/PNG/WebP up to 10 MB and rejects the rest", () => {
    expect(photoProblem({ type: "image/png", size: 5 })).toBeNull();
    expect(photoProblem({ type: "image/png", size: 0 })).toMatch(/empty/);
    expect(photoProblem({ type: "text/plain", size: 5 })).toMatch(/JPEG/);
    expect(photoProblem({ type: "image/webp", size: 10 * 1024 * 1024 + 1 })).toMatch(
      /10 MB/,
    );
  });
});

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
  it("rejects an empty file (backend requires at least 1 byte)", async () => {
    const empty = new File([], "empty.png", { type: "image/png" });
    await expect(stripPhotoMetadata(empty)).rejects.toThrow(
      "The selected photo is empty",
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
