import { describe, it, expect } from "vitest";
import { apiKeySchema } from "./integrations";

describe("apiKeySchema", () => {
  it("accepts a non-blank name", () => {
    expect(apiKeySchema.safeParse({ name: "Accounting sync" }).success).toBe(
      true,
    );
  });
  it("rejects a blank name", () => {
    expect(apiKeySchema.safeParse({ name: "" }).success).toBe(false);
  });
});
