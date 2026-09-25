import { render, screen } from "@testing-library/react";
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

it("retires an active asset", async () => {
  render(<AssetsPanel org="org" building="building" />);
  await userEvent.setup().click(screen.getByRole("button", { name: "Retire" }));
  expect(setStatus).toHaveBeenCalledWith("asset-1", "RETIRED");
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
