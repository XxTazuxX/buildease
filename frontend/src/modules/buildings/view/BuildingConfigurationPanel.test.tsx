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
