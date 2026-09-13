import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { it, expect, vi } from "vitest";
import { LoginPage } from "./AuthPages";
const signIn = vi
  .fn()
  .mockRejectedValue(new Error("Invalid credentials or session"));
vi.mock("../viewmodel/AuthProvider", () => ({ useAuth: () => ({ signIn }) }));
it("renders an accessible login form and shows server errors without password disclosure", async () => {
  render(<LoginPage />);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Email"), "user@example.test");
  await user.type(screen.getByLabelText("Password"), "private password");
  await user.click(screen.getByRole("button", { name: "Sign in" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Invalid credentials or session",
  );
  expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
  expect(screen.queryByText("private password")).not.toBeInTheDocument();
});
