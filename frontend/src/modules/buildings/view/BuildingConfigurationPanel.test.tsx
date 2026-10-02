import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { BuildingConfigurationPanel } from "./BuildingConfigurationPanel";
import { useBuildingConfiguration } from "../viewmodel/useBuildingConfiguration";

vi.mock("../viewmodel/useBuildingConfiguration", () => ({
  useBuildingConfiguration: vi.fn(),
}));

let configure: ReturnType<typeof vi.fn>;
let createLevel: ReturnType<typeof vi.fn>;
let createSpace: ReturnType<typeof vi.fn>;

beforeEach(() => {
  configure = vi.fn().mockResolvedValue(true);
  createLevel = vi.fn().mockResolvedValue(true);
  createSpace = vi.fn().mockResolvedValue(true);
  vi.mocked(useBuildingConfiguration).mockReturnValue({
    profile: {
      data: {
        id: "b1",
        name: "Harbor House",
        code: "HH",
        address_line1: null,
        address_line2: null,
        city: null,
        region: null,
        postal_code: null,
        country_code: null,
        timezone: "UTC",
        currency: "USD",
        emergency_contact: null,
        late_fee_amount: null,
        late_fee_grace_days: 5,
      },
      error: null,
    },
    levels: { data: [], error: null, isLoading: false },
    spaces: { data: [], error: null },
    busy: false,
    error: "",
    configure,
    createLevel,
    createSpace,
    setStatus: vi.fn(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
});

const open = async (name: string) => {
  const user = userEvent.setup();
  render(<BuildingConfigurationPanel org="o" building="b" owner />);
  await user.click(screen.getByRole("button", { name }));
  return { user, dialog: await screen.findByRole("dialog") };
};

it("blocks an empty level and flags a malformed code", async () => {
  const { user, dialog } = await open("Add level");
  await user.click(within(dialog).getByRole("button", { name: "Add level" }));
  expect(await within(dialog).findAllByText("Required")).toHaveLength(2);
  await user.type(within(dialog).getByLabelText("Level name"), "Ground");
  await user.type(within(dialog).getByLabelText("Level code"), "bad code");
  await user.tab();
  expect(
    await within(dialog).findByText(
      "Use 1–40 letters, digits, hyphens or underscores",
    ),
  ).toBeInTheDocument();
  expect(createLevel).not.toHaveBeenCalled();
});

it("creates a level with a numeric display order once valid", async () => {
  const { user, dialog } = await open("Add level");
  await user.type(within(dialog).getByLabelText("Level name"), "Ground");
  await user.type(within(dialog).getByLabelText("Level code"), "G-0");
  await user.click(within(dialog).getByRole("button", { name: "Add level" }));
  await waitFor(() => expect(createLevel).toHaveBeenCalledTimes(1));
  expect(createLevel).toHaveBeenCalledWith({
    name: "Ground",
    code: "G-0",
    sortOrder: 0,
  });
});

it("rejects an over-precise area and a zero capacity on a new space", async () => {
  const { user, dialog } = await open("Add space");
  await user.type(within(dialog).getByLabelText("Space name"), "Flat 1");
  await user.type(within(dialog).getByLabelText("Space code"), "F1");
  await user.type(within(dialog).getByLabelText("Area (m²)"), "10.555");
  await user.type(within(dialog).getByLabelText("Capacity"), "0");
  await user.click(within(dialog).getByRole("button", { name: "Add space" }));
  expect(
    await within(dialog).findByText("Use at most 2 decimal places"),
  ).toBeInTheDocument();
  expect(within(dialog).getByText("Must be at least 1")).toBeInTheDocument();
  expect(createSpace).not.toHaveBeenCalled();
});

it("sends nulls for the optional space fields left blank", async () => {
  const { user, dialog } = await open("Add space");
  await user.type(within(dialog).getByLabelText("Space name"), "Flat 1");
  await user.type(within(dialog).getByLabelText("Space code"), "F1");
  await user.click(within(dialog).getByRole("button", { name: "Add space" }));
  await waitFor(() => expect(createSpace).toHaveBeenCalledTimes(1));
  expect(createSpace).toHaveBeenCalledWith(
    expect.objectContaining({
      levelId: null,
      parentSpaceId: null,
      area: null,
      capacity: null,
      rentable: true,
      type: "FLAT",
    }),
  );
});

const level = {
  id: "level-1",
  name: "Ground",
  code: "G0",
  sort_order: 2,
  active: true,
};
const flat = {
  id: "space-1",
  level_id: "level-1",
  parent_space_id: null,
  name: "Flat 1",
  code: "F1",
  type: "FLAT",
  status: "VACANT",
  rentable: true,
  area: 55.5,
  capacity: 4,
  notes: "Sunny",
};
const wing = { ...flat, id: "space-2", name: "Wing", code: "W1" };

function withStructure(overrides: Record<string, unknown> = {}) {
  const base = vi.mocked(useBuildingConfiguration)("o", "b");
  const vm = {
    ...base,
    levels: { data: [level], error: null, isLoading: false },
    spaces: { data: [flat, wing], error: null },
    updateLevel: vi.fn().mockResolvedValue(true),
    deleteLevel: vi.fn().mockResolvedValue(true),
    updateSpace: vi.fn().mockResolvedValue(true),
    deleteSpace: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(useBuildingConfiguration).mockReturnValue(vm as any);
  return vm;
}

it("edits a level with its stored values and saves the changes", async () => {
  const vm = withStructure();
  const { user, dialog } = await open("Edit level Ground");
  expect(within(dialog).getByText("Edit level or zone")).toBeInTheDocument();
  expect(within(dialog).getByLabelText("Level name")).toHaveValue("Ground");
  expect(within(dialog).getByLabelText("Level code")).toHaveValue("G0");
  expect(within(dialog).getByLabelText("Display order")).toHaveValue(2);

  const name = within(dialog).getByLabelText("Level name");
  await user.clear(name);
  await user.type(name, "Lobby");
  await user.click(within(dialog).getByRole("button", { name: "Save level" }));
  await waitFor(() => expect(vm.updateLevel).toHaveBeenCalledTimes(1));
  expect(vm.updateLevel).toHaveBeenCalledWith("level-1", {
    name: "Lobby",
    code: "G0",
    sortOrder: 2,
  });
});

it("validates a level edit before saving it", async () => {
  const vm = withStructure();
  const { user, dialog } = await open("Edit level Ground");
  await user.clear(within(dialog).getByLabelText("Level code"));
  await user.click(within(dialog).getByRole("button", { name: "Save level" }));
  expect(await within(dialog).findByText("Required")).toBeInTheDocument();
  expect(vm.updateLevel).not.toHaveBeenCalled();
});

it("edits a space, excludes itself from the parent choices and saves", async () => {
  const vm = withStructure();
  const { user, dialog } = await open("Edit space Flat 1");
  expect(
    within(dialog).getByText("Edit flat, room, or space"),
  ).toBeInTheDocument();
  expect(within(dialog).getByLabelText("Space name")).toHaveValue("Flat 1");
  expect(within(dialog).getByLabelText("Space code")).toHaveValue("F1");
  expect(within(dialog).getByLabelText("Area (m²)")).toHaveValue(55.5);
  expect(within(dialog).getByLabelText("Capacity")).toHaveValue(4);
  expect(within(dialog).getByLabelText("Notes")).toHaveValue("Sunny");

  await user.click(within(dialog).getByLabelText("Parent space"));
  const options = await screen.findAllByRole("option");
  expect(options.map((option) => option.textContent)).toContain("Wing");
  expect(options.map((option) => option.textContent)).not.toContain("Flat 1");
  await user.click(screen.getByRole("option", { name: "Wing" }));

  const name = within(dialog).getByLabelText("Space name");
  await user.clear(name);
  await user.type(name, "Corner flat");
  await user.click(within(dialog).getByRole("button", { name: "Save space" }));
  await waitFor(() => expect(vm.updateSpace).toHaveBeenCalledTimes(1));
  expect(vm.updateSpace).toHaveBeenCalledWith(
    "space-1",
    expect.objectContaining({
      name: "Corner flat",
      code: "F1",
      levelId: "level-1",
      parentSpaceId: "space-2",
      rentable: true,
      area: 55.5,
      capacity: 4,
    }),
  );
});

it("validates a space edit before saving it", async () => {
  const vm = withStructure();
  const { user, dialog } = await open("Edit space Flat 1");
  await user.clear(within(dialog).getByLabelText("Space name"));
  await user.click(within(dialog).getByRole("button", { name: "Save space" }));
  expect(await within(dialog).findByText("Required")).toBeInTheDocument();
  expect(vm.updateSpace).not.toHaveBeenCalled();
});

it("confirms before deleting a level and passes the id", async () => {
  const vm = withStructure();
  const { user } = await open("Delete level Ground");
  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).getByText(/Permanently delete .*Ground/)).toBeVisible();
  await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
  expect(vm.deleteLevel).not.toHaveBeenCalled();

  await user.click(screen.getByRole("button", { name: "Delete level Ground" }));
  await user.click(
    within(await screen.findByRole("dialog")).getByRole("button", {
      name: "Delete level",
    }),
  );
  await waitFor(() => expect(vm.deleteLevel).toHaveBeenCalledWith("level-1"));
});

it("shows the server's reason and keeps the dialog open when a space cannot be deleted", async () => {
  const vm = withStructure({
    deleteSpace: vi.fn().mockResolvedValue(false),
    error:
      "This space has leases, residents, listings, requests, inspections or assets and cannot be deleted. Mark it Inactive instead",
  });
  const { user } = await open("Delete space Flat 1");
  await user.click(
    within(await screen.findByRole("dialog")).getByRole("button", {
      name: "Delete space",
    }),
  );
  await waitFor(() => expect(vm.deleteSpace).toHaveBeenCalledWith("space-1"));
  expect(
    within(screen.getByRole("dialog")).getByText(/Mark it Inactive instead/),
  ).toBeInTheDocument();
});

it("does not offer Delete for an occupied space but still allows Edit", () => {
  withStructure({
    spaces: {
      data: [{ ...flat, status: "OCCUPIED" }],
      error: null,
    },
  });
  render(<BuildingConfigurationPanel org="o" building="b" owner />);
  expect(
    screen.getByRole("button", { name: "Edit space Flat 1" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Delete space Flat 1" }),
  ).not.toBeInTheDocument();
});

it("hides every edit and delete action from non-owners", () => {
  withStructure();
  render(<BuildingConfigurationPanel org="o" building="b" owner={false} />);
  expect(
    screen.queryByRole("button", { name: /^Edit / }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /^Delete / }),
  ).not.toBeInTheDocument();
});

it("validates building settings and omits a blank country code", async () => {
  const { user, dialog } = await open("Building settings");
  const currency = within(dialog).getByLabelText("Currency");
  await user.clear(currency);
  await user.type(currency, "US");
  await user.click(
    within(dialog).getByRole("button", { name: "Save building settings" }),
  );
  expect(
    await within(dialog).findByText("Use a 3-letter currency code"),
  ).toBeInTheDocument();
  expect(configure).not.toHaveBeenCalled();
  await user.type(currency, "D");
  await user.click(
    within(dialog).getByRole("button", { name: "Save building settings" }),
  );
  await waitFor(() => expect(configure).toHaveBeenCalledTimes(1));
  expect(configure.mock.calls[0][0]).toMatchObject({
    currency: "USD",
    countryCode: undefined,
    lateFeeAmount: null,
    lateFeeGraceDays: 5,
  });
});
