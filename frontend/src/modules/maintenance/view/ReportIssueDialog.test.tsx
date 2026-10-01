import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { ReportIssueDialog } from "./ReportIssueDialog";
import type { useMaintenance } from "../viewmodel/useMaintenance";

let submit: ReturnType<typeof vi.fn>;
let vm: ReturnType<typeof useMaintenance>;

const spaceId = "11111111-1111-4111-8111-111111111111";
const categoryId = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  submit = vi.fn().mockResolvedValue(true);
  vm = {
    categories: {
      data: [{ id: categoryId, name: "Plumbing" }],
      isLoading: false,
    },
    spaces: { data: [{ id: spaceId, name: "Flat 1", code: "F1" }] },
    busy: false,
    submit,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
});

const open = () => render(<ReportIssueDialog open onClose={vi.fn()} vm={vm} />);

it("blocks an empty report and shows each required field", async () => {
  open();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Submit request" }));
  expect(await screen.findByText("Select a space")).toBeInTheDocument();
  expect(screen.getByText("Select a category")).toBeInTheDocument();
  expect(screen.getAllByText("Required")).toHaveLength(2);
  expect(submit).not.toHaveBeenCalled();
});

it("submits trimmed values once the report is complete", async () => {
  open();
  const user = userEvent.setup();
  await user.click(screen.getByLabelText("Space"));
  await user.click(await screen.findByRole("option", { name: "Flat 1 · F1" }));
  await user.click(screen.getByLabelText("Category"));
  await user.click(await screen.findByRole("option", { name: "Plumbing" }));
  await user.type(screen.getByLabelText("Short title"), "  Leaking tap ");
  await user.type(screen.getByLabelText("What happened?"), "Drips all day");
  await user.click(screen.getByRole("button", { name: "Submit request" }));
  await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
  expect(submit.mock.calls[0][0]).toMatchObject({
    spaceId,
    categoryId,
    title: "Leaking tap",
    description: "Drips all day",
    impact: "MEDIUM",
    danger: false,
  });
});

it("rejects a non-image photo as soon as it is chosen and blocks the submit", async () => {
  open();
  const input = document.querySelector('input[type="file"]') as HTMLElement;
  fireEvent.change(input, {
    target: {
      files: [new File(["x"], "notes.txt", { type: "text/plain" })],
    },
  });
  expect(
    await screen.findByText("Choose a JPEG, PNG, or WebP photo up to 10 MB"),
  ).toBeInTheDocument();
  const user = userEvent.setup();
  await user.click(screen.getByLabelText("Space"));
  await user.click(await screen.findByRole("option", { name: "Flat 1 · F1" }));
  await user.click(screen.getByLabelText("Category"));
  await user.click(await screen.findByRole("option", { name: "Plumbing" }));
  await user.type(screen.getByLabelText("Short title"), "Leak");
  await user.type(screen.getByLabelText("What happened?"), "Drips");
  await user.click(screen.getByRole("button", { name: "Submit request" }));
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(submit).not.toHaveBeenCalled();
});
