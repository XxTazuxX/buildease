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
