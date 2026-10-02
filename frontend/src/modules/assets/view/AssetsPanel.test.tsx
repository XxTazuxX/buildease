import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, it, expect, vi } from "vitest";
import { AssetsPanel } from "./AssetsPanel";
import {
  useAssetDetail,
  useAssets,
  useAssetSpaces,
} from "../viewmodel/useAssets";

vi.mock("../viewmodel/useAssets", () => ({
  useAssets: vi.fn(),
  useAssetSpaces: vi.fn(),
  useAssetDetail: vi.fn(),
}));

let setStatus: ReturnType<typeof vi.fn>;
let recordMeterReading: ReturnType<typeof vi.fn>;
beforeEach(() => {
  setStatus = vi.fn().mockResolvedValue(true);
  recordMeterReading = vi.fn().mockResolvedValue(true);
  vi.mocked(useAssets).mockReturnValue({
    list: {
      data: [
        {
          id: "asset-1",
          space_id: "space-1",
          name: "Rooftop HVAC Unit",
          category: "HVAC",
          manufacturer: "Carrier",
          model: "50TCQ",
          warranty_expires_on: "2030-01-01",
          status: "ACTIVE",
        },
      ],
      error: null,
    },
    busy: false,
    error: "",
    create: vi.fn(),
    setStatus,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  vi.mocked(useAssetSpaces).mockReturnValue({
    data: [{ id: "space-1", name: "Roof", code: "ROOF" }],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  vi.mocked(useAssetDetail).mockReturnValue({
    detail: { data: undefined, isLoading: false, error: null },
    busy: false,
    error: "",
    recordMeterReading,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
});

it("lists assets with their category, space, and warranty", () => {
  render(<AssetsPanel org="org" building="building" />);
  expect(screen.getByText("Rooftop HVAC Unit")).toBeInTheDocument();
  expect(screen.getByText(/HVAC · Roof/)).toBeInTheDocument();
  expect(screen.getByText(/Warranty until 2030-01-01/)).toBeInTheDocument();
  expect(screen.getByText("ACTIVE")).toBeInTheDocument();
});

it("asks for confirmation before deleting an asset", async () => {
  const remove = vi.fn().mockResolvedValue(true);
  vi.mocked(useAssets).mockReturnValue({
    ...vi.mocked(useAssets)("org", "building"),
    remove,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  render(<AssetsPanel org="org" building="building" />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Delete" }));
  const dialog = await screen.findByRole("dialog");
  expect(
    within(dialog).getByText(/Permanently delete .*Rooftop HVAC Unit/),
  ).toBeInTheDocument();
  await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
  expect(remove).not.toHaveBeenCalled();

  await user.click(screen.getByRole("button", { name: "Delete" }));
  await user.click(
    within(await screen.findByRole("dialog")).getByRole("button", {
      name: "Delete asset",
    }),
  );
  await waitFor(() => expect(remove).toHaveBeenCalledWith("asset-1"));
});

it("keeps the delete confirmation open and shows why the server refused", async () => {
  vi.mocked(useAssets).mockReturnValue({
    ...vi.mocked(useAssets)("org", "building"),
    remove: vi.fn().mockResolvedValue(false),
    error:
      "Meter readings are recorded for this asset, so it cannot be deleted",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  render(<AssetsPanel org="org" building="building" />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Delete" }));
  await user.click(
    within(await screen.findByRole("dialog")).getByRole("button", {
      name: "Delete asset",
    }),
  );
  expect(
    within(screen.getByRole("dialog")).getByText(/Meter readings are recorded/),
  ).toBeInTheDocument();
});

it("retires an active asset", async () => {
  render(<AssetsPanel org="org" building="building" />);
  await userEvent.setup().click(screen.getByRole("button", { name: "Retire" }));
  expect(setStatus).toHaveBeenCalledWith("asset-1", "RETIRED");
});

it("blocks an empty asset and shows the required-name error inline", async () => {
  const create = vi.fn().mockResolvedValue(true);
  vi.mocked(useAssets).mockReturnValue({
    ...vi.mocked(useAssets)("org", "building"),
    create,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  render(<AssetsPanel org="org" building="building" />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Add asset" }));
  const dialog = await screen.findByRole("dialog");
  await user.click(within(dialog).getByRole("button", { name: "Add asset" }));
  expect(await within(dialog).findByText("Required")).toBeInTheDocument();
  expect(create).not.toHaveBeenCalled();
});

it("flags an over-long name and submits trimmed values once valid", async () => {
  const create = vi.fn().mockResolvedValue(true);
  vi.mocked(useAssets).mockReturnValue({
    ...vi.mocked(useAssets)("org", "building"),
    create,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  render(<AssetsPanel org="org" building="building" />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Add asset" }));
  const dialog = await screen.findByRole("dialog");
  const name = within(dialog).getByLabelText("Name");
  await user.click(name);
  await user.paste("n".repeat(161));
  await user.tab();
  expect(
    await within(dialog).findByText("Use at most 160 characters"),
  ).toBeInTheDocument();
  await user.clear(name);
  await user.type(name, "  Boiler  ");
  await user.click(within(dialog).getByRole("button", { name: "Add asset" }));
  await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
  expect(create.mock.calls[0][0]).toMatchObject({
    name: "Boiler",
    category: "OTHER",
  });
});

it("rejects a negative or over-precise meter reading", async () => {
  vi.mocked(useAssetDetail).mockReturnValue({
    detail: {
      data: {
        id: "asset-1",
        space_id: null,
        name: "Rooftop HVAC Unit",
        category: "HVAC",
        manufacturer: null,
        model: null,
        serial_number: null,
        install_date: null,
        warranty_expires_on: null,
        status: "ACTIVE",
        notes: null,
        meterReadings: [],
      },
      isLoading: false,
      error: null,
    },
    busy: false,
    error: "",
    recordMeterReading,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  render(<AssetsPanel org="org" building="building" />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "View" }));
  await user.type(screen.getByLabelText("Value"), "1.234");
  await user.click(screen.getByRole("button", { name: "Log reading" }));
  expect(
    await screen.findByText("Use at most 2 decimal places"),
  ).toBeInTheDocument();
  expect(recordMeterReading).not.toHaveBeenCalled();
});

it("opens the detail dialog and logs a meter reading", async () => {
  vi.mocked(useAssetDetail).mockReturnValue({
    detail: {
      data: {
        id: "asset-1",
        space_id: "space-1",
        name: "Rooftop HVAC Unit",
        category: "HVAC",
        manufacturer: "Carrier",
        model: "50TCQ",
        serial_number: "SN-1",
        install_date: "2020-01-01",
        warranty_expires_on: "2030-01-01",
        status: "ACTIVE",
        notes: null,
        meterReadings: [],
      },
      isLoading: false,
      error: null,
    },
    busy: false,
    error: "",
    recordMeterReading,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  render(<AssetsPanel org="org" building="building" />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "View" }));
  await user.type(screen.getByLabelText("Value"), "1200");
  await user.click(screen.getByRole("button", { name: "Log reading" }));
  expect(recordMeterReading).toHaveBeenCalledWith(1200, "hours");
});
