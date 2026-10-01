import { describe, expect, it } from "vitest";
import {
  emailTemplateSchema,
  mailSettingsSchema,
  mailTestSchema,
  memberProfileSchema,
} from "./admin";

describe("mailSettingsSchema", () => {
  const valid = {
    host: "smtp.example.test",
    port: "587",
    username: "user",
    password: "",
    from: "noreply@example.test",
    starttls: true,
  };

  it("parses the port to a number and keeps a blank password", () => {
    expect(mailSettingsSchema.parse(valid)).toMatchObject({
      port: 587,
      password: "",
    });
  });

  it.each(["0", "65536", "25.5", "", "abc"])("rejects port %s", (port) => {
    expect(mailSettingsSchema.safeParse({ ...valid, port }).success).toBe(
      false,
    );
  });

  it("enforces the backend length limits", () => {
    expect(
      mailSettingsSchema.safeParse({ ...valid, host: "h".repeat(256) }).success,
    ).toBe(false);
    expect(
      mailSettingsSchema.safeParse({ ...valid, password: "p".repeat(501) })
        .success,
    ).toBe(false);
    expect(
      mailSettingsSchema.safeParse({ ...valid, from: "f".repeat(255) }).success,
    ).toBe(false);
  });
});

describe("mailTestSchema", () => {
  it("requires a valid recipient email up to 254 characters", () => {
    expect(mailTestSchema.safeParse({ recipient: "" }).success).toBe(false);
    expect(mailTestSchema.safeParse({ recipient: "nope" }).success).toBe(false);
    expect(mailTestSchema.parse({ recipient: " a@b.co " }).recipient).toBe(
      "a@b.co",
    );
  });
});

describe("emailTemplateSchema", () => {
  it("requires a subject (200) and body (4000)", () => {
    expect(
      emailTemplateSchema.safeParse({ subject: "", body: "x" }).success,
    ).toBe(false);
    expect(
      emailTemplateSchema.safeParse({ subject: "s".repeat(201), body: "x" })
        .success,
    ).toBe(false);
    expect(
      emailTemplateSchema.safeParse({ subject: "s", body: "b".repeat(4001) })
        .success,
    ).toBe(false);
    expect(
      emailTemplateSchema.safeParse({ subject: "s", body: "b" }).success,
    ).toBe(true);
  });
});

describe("memberProfileSchema", () => {
  it("requires a display name of at most 120 characters", () => {
    expect(memberProfileSchema.safeParse({ displayName: "  " }).success).toBe(
      false,
    );
    expect(
      memberProfileSchema.safeParse({ displayName: "n".repeat(121) }).success,
    ).toBe(false);
    expect(memberProfileSchema.parse({ displayName: " Sam " }).displayName).toBe(
      "Sam",
    );
  });
});
