import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { ConfirmDialog } from "./ConfirmDialog";

const setup = (props: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) => {
  const onConfirm = vi.fn();
  const onClose = vi.fn();
  render(
    <ConfirmDialog
      title="Delete thing"
      confirmLabel="Delete thing"
      onConfirm={onConfirm}
      onClose={onClose}
      {...props}
    >
      Really delete it?
    </ConfirmDialog>,
  );
  return { onConfirm, onClose, user: userEvent.setup() };
};

it("shows the title and message and confirms or cancels", async () => {
  const { onConfirm, onClose, user } = setup();
  expect(screen.getByText("Really delete it?")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(onConfirm).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Delete thing" }));
  expect(onConfirm).toHaveBeenCalledTimes(1);
});

it("shows the server's reason in place when the action is refused", () => {
  setup({ error: "In use, so it cannot be deleted" });
  expect(screen.getByRole("alert")).toHaveTextContent(
    "In use, so it cannot be deleted",
  );
});

it("disables the confirm button while the action runs", () => {
  setup({ busy: true });
  expect(screen.getByRole("button", { name: "Delete thing" })).toBeDisabled();
});

it("supports a custom cancel label for non-destructive confirmations", () => {
  setup({ cancelLabel: "Keep it", destructive: false });
  expect(screen.getByRole("button", { name: "Keep it" })).toBeInTheDocument();
});
