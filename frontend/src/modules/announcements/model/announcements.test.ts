import { describe, it, expect } from "vitest";
import { announcementSchema } from "./announcements";

describe("announcementSchema", () => {
  const valid = {
    title: "Water shutoff",
    body: "Water will be off from 10am to noon.",
    audience: "ALL_RESIDENTS" as const,
  };
  it("accepts a well-formed announcement", () => {
    expect(announcementSchema.safeParse(valid).success).toBe(true);
  });
  it("rejects a blank title or body", () => {
    expect(announcementSchema.safeParse({ ...valid, title: "" }).success).toBe(
      false,
    );
    expect(announcementSchema.safeParse({ ...valid, body: "" }).success).toBe(
      false,
    );
  });
  it("rejects an unknown audience", () => {
    expect(
      announcementSchema.safeParse({ ...valid, audience: "EVERYONE" }).success,
    ).toBe(false);
  });
});
