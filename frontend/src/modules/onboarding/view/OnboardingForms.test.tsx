import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, it, expect, vi } from "vitest";
import { OnboardingForm } from "./OnboardingForms";
import { useOnboarding } from "../viewmodel/useOnboarding";

vi.mock("../viewmodel/useOnboarding", () => ({ useOnboarding: vi.fn() }));

beforeEach(() => {
  vi.mocked(useOnboarding).mockReturnValue({
    message: "",
    error: "",
    busy: false,
    submit: vi.fn(),
  });
});

it("collects registration details and submits them", async () => {
  const submit = vi.fn();
  vi.mocked(useOnboarding).mockReturnValue({
    message: "",
    error: "",
    busy: false,
    submit,
  });
  render(<OnboardingForm mode="register" back={vi.fn()} />);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Email"), "owner@example.test");
  await user.type(screen.getByLabelText("Your name"), "Owner");
  await user.type(screen.getByLabelText("Organization name"), "Acme");
  await user.type(
    screen.getByLabelText("Password"),
    "a very safe password phrase",
  );
  await user.click(screen.getByRole("button", { name: "Continue" }));
  expect(submit).toHaveBeenCalledWith({
    email: "owner@example.test",
    displayName: "Owner",
    organizationName: "Acme",
    password: "a very safe password phrase",
  });
});

it("disables continue for a reset without a token and hides it once a message arrives", () => {
  vi.mocked(useOnboarding).mockReturnValue({
    message: "",
    error: "",
    busy: false,
    submit: vi.fn(),
  });
  const { rerender } = render(<OnboardingForm mode="reset" back={vi.fn()} />);
  expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();

  vi.mocked(useOnboarding).mockReturnValue({
    message: "Password changed. You can now sign in.",
    error: "",
    busy: false,
    submit: vi.fn(),
  });
  rerender(<OnboardingForm mode="reset" back={vi.fn()} />);
  expect(
    screen.queryByRole("button", { name: "Continue" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByText("Password changed. You can now sign in."),
  ).toBeInTheDocument();
});

it("shows the server error and calls back when leaving", async () => {
  const back = vi.fn();
  vi.mocked(useOnboarding).mockReturnValue({
    message: "",
    error: "Too many registration attempts. Try again later.",
    busy: false,
    submit: vi.fn(),
  });
  render(<OnboardingForm mode="register" back={back} />);
  expect(
    screen.getByText("Too many registration attempts. Try again later."),
  ).toBeInTheDocument();
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Back to sign in" }));
  expect(back).toHaveBeenCalled();
});
