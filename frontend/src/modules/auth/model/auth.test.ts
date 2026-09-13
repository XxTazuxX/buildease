import { describe, it, expect } from "vitest";
import { passwordSchema, changeSchema } from "./auth";
describe("password rules", () => {
  it("rejects short, long and oversized Unicode secrets without truncation", () => {
    for (const password of [
      "short",
      "a".repeat(65),
      "界".repeat(25),
      "😀".repeat(14),
    ])
      expect(passwordSchema.safeParse(password).success).toBe(false);
    expect(passwordSchema.safeParse("a secure password phrase").success).toBe(
      true,
    );
  });
  it("requires matching confirmation", () => {
    expect(
      changeSchema.safeParse({
        oldPassword: "old",
        newPassword: "a secure password phrase",
        confirmPassword: "different",
      }).success,
    ).toBe(false);
  });
});
