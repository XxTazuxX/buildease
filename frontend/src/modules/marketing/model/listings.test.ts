import { describe, it, expect } from "vitest";
import { newListingSchema, updateListingSchema } from "./listings";

describe("updateListingSchema", () => {
  const body = { headline: " New ", description: "d", rentAmount: 10 };
  it("keeps the same text and rent rules but drops the space", () => {
    expect(updateListingSchema.parse({ ...body, spaceId: "x" })).toEqual({
      headline: "New",
      description: "d",
      rentAmount: 10,
    });
    expect(
      updateListingSchema.safeParse({ ...body, headline: "" }).success,
    ).toBe(false);
    expect(
      updateListingSchema.safeParse({ ...body, rentAmount: 0 }).success,
    ).toBe(false);
  });
});

describe("newListingSchema", () => {
  const valid = {
    spaceId: "11111111-1111-1111-1111-111111111111",
    headline: "Bright 1BR near the harbor",
    description: "Freshly renovated, available now.",
    rentAmount: 1200,
  };
  it("accepts a well-formed listing", () => {
    expect(newListingSchema.safeParse(valid).success).toBe(true);
  });
  it("rejects a non-positive rent amount", () => {
    expect(
      newListingSchema.safeParse({ ...valid, rentAmount: 0 }).success,
    ).toBe(false);
  });
  it("rejects a blank headline or description", () => {
    expect(newListingSchema.safeParse({ ...valid, headline: "" }).success).toBe(
      false,
    );
    expect(
      newListingSchema.safeParse({ ...valid, description: "" }).success,
    ).toBe(false);
  });
});
