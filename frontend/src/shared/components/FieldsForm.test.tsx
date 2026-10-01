import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FieldsForm, type Field } from "./FieldsForm";

const fields: Field[] = [
  { name: "name", label: "Name", max: 5 },
  { name: "email", label: "Email", type: "email", max: 20 },
  {
    name: "code",
    label: "Code",
    max: 8,
    pattern: /^[A-Za-z0-9_-]{1,8}$/,
    patternMessage: "Letters, digits, - or _ only",
  },
  { name: "pw", label: "Password", password: true, optional: true },
];

describe("FieldsForm", () => {
  it("shows each backend rule inline and blocks the submit", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<FieldsForm fields={fields} onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText("Name"), "toolong");
    await user.type(screen.getByLabelText("Email"), "not-an-email");
    await user.type(screen.getByLabelText("Code"), "bad code");
    await user.type(screen.getByLabelText("Password"), "short");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(
      await screen.findByText("Use at most 5 characters"),
    ).toBeInTheDocument();
    expect(screen.getByText("Enter a valid email address")).toBeInTheDocument();
    expect(screen.getByText("Letters, digits, - or _ only")).toBeInTheDocument();
    expect(
      screen.getByText("Use 15–64 characters, at most 72 UTF-8 bytes"),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("allows a blank optional password and submits trimmed values", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<FieldsForm fields={fields} onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText("Name"), " Ann ");
    await user.type(screen.getByLabelText("Email"), "ann@example.com");
    await user.type(screen.getByLabelText("Code"), "A-1");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toEqual({
      name: "Ann",
      email: "ann@example.com",
      code: "A-1",
      pw: "",
    });
  });
});
