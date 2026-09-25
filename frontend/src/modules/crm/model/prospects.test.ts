import { describe, it, expect } from "vitest";
import { newProspectSchema } from "./prospects";

describe("newProspectSchema", () => {
  const valid = {
    spaceId: "11111111-1111-1111-1111-111111111111",
    name: "Jane Prospect",
  };
  it("accepts a prospect with only a space and name", () => {
    expect(newProspectSchema.safeParse(valid).success).toBe(true);
  });
  it("accepts a blank email but rejects a malformed one", () => {
    expect(newProspectSchema.safeParse({ ...valid, email: "" }).success).toBe(
      true,
    );
    expect(
      newProspectSchema.safeParse({ ...valid, email: "not-an-email" }).success,
    ).toBe(false);
  });
  it("rejects a blank name", () => {
    expect(newProspectSchema.safeParse({ ...valid, name: "" }).success).toBe(
      false,
    );
  });
});
