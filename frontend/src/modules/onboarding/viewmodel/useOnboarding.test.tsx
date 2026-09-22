import { renderHook, waitFor, act } from "@testing-library/react";
import { beforeEach, it, expect, vi } from "vitest";
import { useOnboarding } from "./useOnboarding";
import { onboardingApi } from "../model/onboarding";

vi.mock("../model/onboarding", () => ({
  onboardingApi: {
    register: vi.fn(),
    verify: vi.fn(),
    forgot: vi.fn(),
    reset: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

it("verifies automatically when mounted in verify mode with a token", async () => {
  vi.mocked(onboardingApi.verify).mockResolvedValue({
    organizationId: "org-1",
  });
  const { result } = renderHook(() => useOnboarding("verify", "the-token"));
  await waitFor(() => expect(result.current.busy).toBe(false));
  expect(onboardingApi.verify).toHaveBeenCalledWith("the-token");
  expect(result.current.message).toBe(
    "Your workspace is ready. You can now sign in.",
  );
});

it("surfaces the server error when verification fails", async () => {
  vi.mocked(onboardingApi.verify).mockRejectedValue(
    new Error("Verification link is invalid or expired"),
  );
  const { result } = renderHook(() => useOnboarding("verify", "bad-token"));
  await waitFor(() => expect(result.current.busy).toBe(false));
  expect(result.current.error).toBe("Verification link is invalid or expired");
});

it("does not call verify when no token is present", () => {
  renderHook(() => useOnboarding("verify", ""));
  expect(onboardingApi.verify).not.toHaveBeenCalled();
});

it("registers with the submitted values and shows a confirmation message", async () => {
  vi.mocked(onboardingApi.register).mockResolvedValue(undefined);
  const { result } = renderHook(() => useOnboarding("register", ""));
  const values = {
    email: "owner@example.test",
    displayName: "Owner",
    organizationName: "Acme",
    password: "a very safe password phrase",
  };
  await act(async () => {
    await result.current.submit(values);
  });
  expect(onboardingApi.register).toHaveBeenCalledWith(values);
  expect(result.current.message).toContain("Check your email");
});

it("resets the password using the token supplied at construction", async () => {
  vi.mocked(onboardingApi.reset).mockResolvedValue(undefined);
  const { result } = renderHook(() => useOnboarding("reset", "reset-token"));
  await act(async () => {
    await result.current.submit({
      email: "",
      displayName: "",
      organizationName: "",
      password: "a brand new safe password",
    });
  });
  expect(onboardingApi.reset).toHaveBeenCalledWith(
    "reset-token",
    "a brand new safe password",
  );
  expect(result.current.message).toBe("Password changed. You can now sign in.");
});

it("surfaces an error and clears the busy flag when a request fails", async () => {
  vi.mocked(onboardingApi.forgot).mockRejectedValue(
    new Error("Too many attempts. Try again later."),
  );
  const { result } = renderHook(() => useOnboarding("forgot", ""));
  await act(async () => {
    await result.current.submit({
      email: "owner@example.test",
      displayName: "",
      organizationName: "",
      password: "",
    });
  });
  expect(result.current.error).toBe("Too many attempts. Try again later.");
  expect(result.current.busy).toBe(false);
});
