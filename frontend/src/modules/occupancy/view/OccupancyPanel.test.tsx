import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { OccupancyPanel } from "./OccupancyPanel";
import { useOccupancy } from "../viewmodel/useOccupancy";

vi.mock("../viewmodel/useOccupancy", () => ({ useOccupancy: vi.fn() }));

let create: ReturnType<typeof vi.fn>;
let update: ReturnType<typeof vi.fn>;
let addHouseholdMember: ReturnType<typeof vi.fn>;

const resident = {
  id: "r1",
  account_id: "a1",
  display_name: "Sam Tenant",
  phone: null,
  active: true,
  assignments: [],
  assignment_id: null,
  space_id: null,
  starts_on: null,
};

beforeEach(() => {
  create = vi.fn().mockResolvedValue(true);
  update = vi.fn().mockResolvedValue(true);
  addHouseholdMember = vi.fn().mockResolvedValue(true);
  vi.mocked(useOccupancy).mockReturnValue({
    residents: { data: [resident], error: null },
    spaces: { data: [], error: null },
    busy: false,
    error: "",
    create,
    update,
    addHouseholdMember,
    assign: vi.fn(),
    end: vi.fn(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
});

const members = [
  {
    account_id: "a1",
    email: "sam@example.test",
    display_name: "Sam Tenant",
    owner: false,
    status: "ACTIVE",
  },
];
const setup = () =>
  render(<OccupancyPanel org="o" building="b" members={members} />);

it("blocks creating a resident without an account and a name", async () => {
  setup();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Add resident" }));
  const dialog = await screen.findByRole("dialog");
  await user.click(
    within(dialog).getByRole("button", { name: "Create resident" }),
  );
  expect(
    await within(dialog).findByText("Select a tenant account"),
  ).toBeInTheDocument();
  expect(within(dialog).getByText("Required")).toBeInTheDocument();
  expect(create).not.toHaveBeenCalled();
});

it("flags an over-long phone on a new resident", async () => {
  setup();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Add resident" }));
  const dialog = await screen.findByRole("dialog");
  await user.click(within(dialog).getByLabelText("Phone (optional)"));
  await user.paste("1".repeat(41));
  await user.tab();
  expect(
    await within(dialog).findByText("Use at most 40 characters"),
  ).toBeInTheDocument();
});

it("saves resident edits with the validated name", async () => {
  setup();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Edit resident" }));
  const dialog = await screen.findByRole("dialog");
  const name = within(dialog).getByLabelText("Resident name");
  await user.clear(name);
  await user.click(
    within(dialog).getByRole("button", { name: "Save resident" }),
  );
  expect(await within(dialog).findByText("Required")).toBeInTheDocument();
  expect(update).not.toHaveBeenCalled();
  await user.type(name, "  Samuel ");
  await user.click(
    within(dialog).getByRole("button", { name: "Save resident" }),
  );
  await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
  expect(update).toHaveBeenCalledWith("r1", {
    displayName: "Samuel",
    phone: "",
    active: true,
  });
});

it("collects a household member in a validated dialog instead of a prompt", async () => {
  setup();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Add household" }));
  const dialog = await screen.findByRole("dialog");
  await user.click(
    within(dialog).getByRole("button", { name: "Add household member" }),
  );
  expect(await within(dialog).findByText("Required")).toBeInTheDocument();
  expect(addHouseholdMember).not.toHaveBeenCalled();
  await user.type(
    within(dialog).getByLabelText("Household member name"),
    "Kim",
  );
  await user.click(within(dialog).getByLabelText("Relationship (optional)"));
  await user.paste("r".repeat(61));
  await user.click(
    within(dialog).getByRole("button", { name: "Add household member" }),
  );
  expect(
    await within(dialog).findByText("Use at most 60 characters"),
  ).toBeInTheDocument();
  expect(addHouseholdMember).not.toHaveBeenCalled();
});
