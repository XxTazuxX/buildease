import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TextField } from "@mui/material";
import { z } from "zod";
import { requiredEmail, requiredMoney, requiredText } from "./rules";
import { useZodForm } from "./useZodForm";

const schema = z.object({
  name: requiredText(5),
  email: requiredEmail(),
  amount: requiredMoney({ min: 0.01 }),
});

function Harness({ onValid }: { onValid: (v: unknown) => void }) {
  const form = useZodForm(schema, { name: "", email: "", amount: "" });
  return (
    <form onSubmit={form.submit(onValid)}>
      <TextField label="Name" {...form.field("name")} />
      <TextField label="Email" {...form.field("email")} />
      <TextField label="Amount" {...form.field("amount")} />
      <button type="submit">Save</button>
      <button type="button" onClick={() => form.reset()}>
        Reset
      </button>
    </form>
  );
}

describe("useZodForm", () => {
  it("shows no errors before interaction, then a field error after blur", async () => {
    const user = userEvent.setup();
    render(<Harness onValid={vi.fn()} />);
    expect(screen.queryByText("Required")).not.toBeInTheDocument();
    await user.click(screen.getByLabelText("Name"));
    await user.tab();
    expect(await screen.findByText("Required")).toBeInTheDocument();
  });

  it("follows edits and clears the error once the value is valid", async () => {
    const user = userEvent.setup();
    render(<Harness onValid={vi.fn()} />);
    const name = screen.getByLabelText("Name");
    await user.type(name, "abcdefg");
    await user.tab();
    expect(
      await screen.findByText("Use at most 5 characters"),
    ).toBeInTheDocument();
    await user.clear(name);
    await user.type(name, "abc");
    expect(
      screen.queryByText("Use at most 5 characters"),
    ).not.toBeInTheDocument();
  });

  it("blocks an invalid submit and reveals every field error", async () => {
    const user = userEvent.setup();
    const onValid = vi.fn();
    render(<Harness onValid={onValid} />);
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findAllByText("Required")).toHaveLength(3);
    expect(onValid).not.toHaveBeenCalled();
  });

  it("submits the parsed (trimmed, numeric) output when valid", async () => {
    const user = userEvent.setup();
    const onValid = vi.fn();
    render(<Harness onValid={onValid} />);
    await user.type(screen.getByLabelText("Name"), "  Bob ");
    await user.type(screen.getByLabelText("Email"), "bob@example.com");
    await user.type(screen.getByLabelText("Amount"), "12.50");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await vi.waitFor(() => expect(onValid).toHaveBeenCalledTimes(1));
    expect(onValid.mock.calls[0][0]).toEqual({
      name: "Bob",
      email: "bob@example.com",
      amount: 12.5,
    });
  });

  it("restores defaults and hides errors on reset", async () => {
    const user = userEvent.setup();
    render(<Harness onValid={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Save" }));
    await screen.findAllByText("Required");
    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.queryByText("Required")).not.toBeInTheDocument();
  });
});
