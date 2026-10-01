import { describe, expect, it } from "vitest";
import {
  SIGNATURE_DATA_MAX,
  drawingError,
  signFormSchema,
} from "./signatures";

describe("signFormSchema", () => {
  it("requires a signed name of at most 160 characters", () => {
    expect(signFormSchema.safeParse({ signedName: "  " }).success).toBe(false);
    expect(
      signFormSchema.safeParse({ signedName: "n".repeat(161) }).success,
    ).toBe(false);
    expect(signFormSchema.parse({ signedName: " Alex Res " }).signedName).toBe(
      "Alex Res",
    );
  });
});

describe("drawingError", () => {
  it("needs a drawing within the backend size limit", () => {
    expect(drawingError(null)).toMatch(/Draw your signature/);
    expect(drawingError("x".repeat(SIGNATURE_DATA_MAX + 1))).toMatch(
      /too large/,
    );
    expect(drawingError("x".repeat(SIGNATURE_DATA_MAX))).toBeNull();
  });
});
