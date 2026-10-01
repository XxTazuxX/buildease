import { describe, expect, it } from "vitest";
import { onboardingSchema } from "./onboarding";

const blank = { email: "", displayName: "", organizationName: "", password: "" };

describe("onboardingSchema", () => {
  it("validates every registration field against the backend limits", () => {
    const schema = onboardingSchema("register");
    const valid = {
      email: "owner@example.test",
      displayName: "Owner",
      organizationName: "Acme",
      password: "a very safe password phrase",
    };
    expect(schema.safeParse(valid).success).toBe(true);
    expect(schema.safeParse(blank).success).toBe(false);
    expect(schema.safeParse({ ...valid, email: "nope" }).success).toBe(false);
    expect(
      schema.safeParse({ ...valid, displayName: "n".repeat(121) }).success,
    ).toBe(false);
    expect(
      schema.safeParse({ ...valid, organizationName: "o".repeat(121) }).success,
    ).toBe(false);
    expect(schema.safeParse({ ...valid, password: "short" }).success).toBe(
      false,
    );
  });

  it("only requires an email to start a password recovery", () => {
    const schema = onboardingSchema("forgot");
    expect(schema.safeParse(blank).success).toBe(false);
    expect(
      schema.safeParse({ ...blank, email: "owner@example.test" }).success,
    ).toBe(true);
  });

  it("only requires a policy-compliant password to reset", () => {
    const schema = onboardingSchema("reset");
    expect(schema.safeParse({ ...blank, password: "short" }).success).toBe(
      false,
    );
    expect(
      schema.safeParse({ ...blank, password: "a very safe password phrase" })
        .success,
    ).toBe(true);
  });
});
