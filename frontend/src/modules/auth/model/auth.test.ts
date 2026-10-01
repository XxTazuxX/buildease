import { describe, it, expect } from "vitest";
import { passwordSchema, changeSchema, loginSchema } from "./auth";
describe("loginSchema", () => {
  it("requires a valid email within 254 characters and a password within 256", () => {
    const ok = { email: "user@example.test", password: "x" };
    expect(loginSchema.safeParse(ok).success).toBe(true);
    expect(loginSchema.safeParse({ ...ok, email: "" }).success).toBe(false);
    expect(loginSchema.safeParse({ ...ok, email: "nope" }).success).toBe(false);
    expect(
      loginSchema.safeParse({ ...ok, email: `${"a".repeat(250)}@b.co` }).success,
    ).toBe(false);
    expect(loginSchema.safeParse({ ...ok, password: "" }).success).toBe(false);
    expect(
      loginSchema.safeParse({ ...ok, password: "p".repeat(257) }).success,
    ).toBe(false);
  });
});
describe("changeSchema reuse rule", () => {
  it("rejects a new password equal to the current one", () => {
    const same = "a secure password phrase";
    const result = changeSchema.safeParse({
      oldPassword: same,
      newPassword: same,
      confirmPassword: same,
    });
    expect(result.success).toBe(false);
    expect(!result.success && result.error.issues[0].message).toBe(
      "Choose a different password",
    );
  });
});
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
