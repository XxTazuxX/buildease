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

function withHousehold(overrides: Record<string, unknown> = {}) {
  const updateHouseholdMember = vi.fn().mockResolvedValue(true);
  const removeHouseholdMember = vi.fn().mockResolvedValue(true);
  const vm = {
    ...vi.mocked(useOccupancy)("o", "b"),
    residents: {
      data: [
        {
          ...resident,
          household: [
            { id: "m1", name: "Kim", relationship: "Partner" },
            { id: "m2", name: "Sam Jr", relationship: null },
          ],
        },
      ],
      error: null,
    },
    updateHouseholdMember,
    removeHouseholdMember,
    ...overrides,
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(useOccupancy).mockReturnValue(vm as any);
  return vm;
}

it("lists each household member with Edit and Remove actions", () => {
  withHousehold();
  setup();
  expect(screen.getByText("Kim (Partner)")).toBeInTheDocument();
  expect(screen.getByText("Sam Jr")).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Edit household member Kim" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Remove household member Sam Jr" }),
  ).toBeInTheDocument();
});

it("edits a household member from a prefilled, validated dialog", async () => {
  const vm = withHousehold();
  setup();
  const user = userEvent.setup();
  await user.click(
    screen.getByRole("button", { name: "Edit household member Kim" }),
  );
  const dialog = await screen.findByRole("dialog");
  const name = within(dialog).getByLabelText("Household member name");
  expect(name).toHaveValue("Kim");
  expect(within(dialog).getByLabelText("Relationship (optional)")).toHaveValue(
    "Partner",
  );

  await user.clear(name);
  await user.click(
    within(dialog).getByRole("button", { name: "Save household member" }),
  );
  expect(await within(dialog).findByText("Required")).toBeInTheDocument();
  expect(vm.updateHouseholdMember).not.toHaveBeenCalled();

  await user.type(name, "Kim Lee");
  await user.click(
    within(dialog).getByRole("button", { name: "Save household member" }),
  );
  await waitFor(() =>
    expect(vm.updateHouseholdMember).toHaveBeenCalledWith(
      "r1",
      "m1",
      "Kim Lee",
      "Partner",
    ),
  );
});

it("confirms before removing a household member", async () => {
  const vm = withHousehold();
  setup();
  const user = userEvent.setup();
  await user.click(
    screen.getByRole("button", { name: "Remove household member Kim" }),
  );
  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).getByText(/Remove .*Kim.* household/)).toBeVisible();
  await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
  expect(vm.removeHouseholdMember).not.toHaveBeenCalled();

  await user.click(
    screen.getByRole("button", { name: "Remove household member Kim" }),
  );
  await user.click(
    within(await screen.findByRole("dialog")).getByRole("button", {
      name: "Remove member",
    }),
  );
  await waitFor(() =>
    expect(vm.removeHouseholdMember).toHaveBeenCalledWith("r1", "m1"),
  );
});

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
