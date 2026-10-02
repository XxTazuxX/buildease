import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { RecurringPlansDialog } from "./RecurringPlansDialog";
import { useRecurringPlans } from "../viewmodel/useMaintenance";

vi.mock("../viewmodel/useMaintenance", () => ({
  useRecurringPlans: vi.fn(),
}));

const spaceId = "11111111-1111-4111-8111-111111111111";
const categoryId = "22222222-2222-4222-8222-222222222222";
const spaces = [{ id: spaceId, name: "Flat 1", code: "F1" }];
const categories = [{ id: categoryId, name: "Plumbing" }];
const stored = {
  id: "plan-1",
  space_id: spaceId,
  category_id: categoryId,
  title: "Boiler service",
  description: "Annual service",
  interval_days: 365,
  next_run_on: "2026-06-01",
  active: true,
};

let vm: Record<string, ReturnType<typeof vi.fn> | unknown>;
beforeEach(() => {
  vm = {
    plans: { data: [stored], error: null },
    busy: false,
    error: "",
    create: vi.fn().mockResolvedValue(true),
    update: vi.fn().mockResolvedValue(true),
    remove: vi.fn().mockResolvedValue(true),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(useRecurringPlans).mockReturnValue(vm as any);
});

const open = () =>
  render(
    <RecurringPlansDialog
      org="o"
      building="b"
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      categories={categories as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      spaces={spaces as any}
      onClose={vi.fn()}
    />,
  );

it("lists plans with Edit and Delete actions", () => {
  open();
  expect(screen.getByText("Boiler service")).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Edit plan Boiler service" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Delete plan Boiler service" }),
  ).toBeInTheDocument();
});

it("edits a plan from the prefilled form and saves it", async () => {
  open();
  const user = userEvent.setup();
  await user.click(
    screen.getByRole("button", { name: "Edit plan Boiler service" }),
  );
  expect(screen.getByText("Edit plan")).toBeInTheDocument();
  expect(screen.getByLabelText("Title")).toHaveValue("Boiler service");
  expect(screen.getByLabelText("Repeat every (days)")).toHaveValue(365);
  expect(screen.getByLabelText("First run")).toHaveValue("2026-06-01");

  const interval = screen.getByLabelText("Repeat every (days)");
  await user.clear(interval);
  await user.type(interval, "180");
  await user.click(screen.getByRole("button", { name: "Save changes" }));
  await waitFor(() => expect(vm.update).toHaveBeenCalledTimes(1));
  expect(vm.update).toHaveBeenCalledWith("plan-1", {
    spaceId,
    categoryId,
    title: "Boiler service",
    description: "Annual service",
    intervalDays: 180,
    nextRunOn: "2026-06-01",
  });
});

it("validates an edit before saving", async () => {
  open();
  const user = userEvent.setup();
  await user.click(
    screen.getByRole("button", { name: "Edit plan Boiler service" }),
  );
  await user.clear(screen.getByLabelText("Title"));
  const interval = screen.getByLabelText("Repeat every (days)");
  await user.clear(interval);
  await user.type(interval, "4000");
  await user.click(screen.getByRole("button", { name: "Save changes" }));
  expect(await screen.findByText("Required")).toBeInTheDocument();
  expect(vm.update).not.toHaveBeenCalled();
});

it("cancelling an edit returns the form to add mode", async () => {
  open();
  const user = userEvent.setup();
  await user.click(
    screen.getByRole("button", { name: "Edit plan Boiler service" }),
  );
  await user.click(screen.getByRole("button", { name: "Cancel edit" }));
  expect(screen.getByText("Add a plan")).toBeInTheDocument();
  expect(screen.getByLabelText("Title")).toHaveValue("");
  expect(vm.update).not.toHaveBeenCalled();
});

it("confirms before deleting a plan", async () => {
  open();
  const user = userEvent.setup();
  await user.click(
    screen.getByRole("button", { name: "Delete plan Boiler service" }),
  );
  const confirm = await screen.findByRole("dialog");
  expect(
    within(confirm).getByText(/Permanently delete .*Boiler service/),
  ).toBeVisible();
  await user.click(within(confirm).getByRole("button", { name: "Cancel" }));
  expect(vm.remove).not.toHaveBeenCalled();

  await user.click(
    screen.getByRole("button", { name: "Delete plan Boiler service" }),
  );
  await user.click(
    within(await screen.findByRole("dialog")).getByRole("button", {
      name: "Delete plan",
    }),
  );
  await waitFor(() => expect(vm.remove).toHaveBeenCalledWith("plan-1"));
});
