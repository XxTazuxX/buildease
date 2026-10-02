import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { notify } from "./notify";
import { errorMessage, reportError } from "./reportError";

beforeEach(() => notify.clear());

describe("errorMessage", () => {
  it("uses an Error's message, otherwise the fallback", () => {
    expect(errorMessage(new Error("Boom"), "Fallback")).toBe("Boom");
    expect(errorMessage(new Error(""), "Fallback")).toBe("Fallback");
    expect(errorMessage("nope", "Fallback")).toBe("Fallback");
  });

  it("reads a validation error as its first problem instead of JSON", () => {
    const result = z.object({ name: z.string().min(1, "Required") }).safeParse({
      name: "",
    });
    expect(
      errorMessage(!result.success ? result.error : null, "Fallback"),
    ).toBe("Required");
  });
});

describe("reportError", () => {
  it("raises an error toast and returns the same message", () => {
    expect(reportError(new Error("Space is in use"), "Operation failed")).toBe(
      "Space is in use",
    );
    expect(notify.snapshot()).toMatchObject([
      { kind: "error", message: "Space is in use" },
    ]);
  });

  it("falls back for unknown failures", () => {
    expect(reportError(undefined, "Operation failed")).toBe("Operation failed");
    expect(notify.snapshot()[0].message).toBe("Operation failed");
  });
});
