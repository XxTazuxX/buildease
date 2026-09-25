import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, it, expect, vi } from "vitest";
import { ReportsPanel } from "./ReportsPanel";
import {
  useIncomeStatement,
  useLeasesForStatement,
  useLeaseStatement,
  useMaintenanceReport,
  useOccupancyReport,
  useRentRoll,
  useReportExports,
} from "../viewmodel/useReporting";

vi.mock("../viewmodel/useReporting", () => ({
  useRentRoll: vi.fn(),
  useIncomeStatement: vi.fn(),
  useLeasesForStatement: vi.fn(),
  useLeaseStatement: vi.fn(),
  useOccupancyReport: vi.fn(),
  useMaintenanceReport: vi.fn(),
  useReportExports: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(useRentRoll).mockReturnValue({
    data: [
      {
        lease_id: "lease-1",
        resident_id: "resident-1",
        resident_name: "Jane Tenant",
        space_id: "space-1",
        space_name: "Flat 1",
        space_code: "F1",
        rent_amount: "1200.00",
        currency: "USD",
        next_charge_on: "2026-02-01",
        starts_on: "2026-01-01",
        ends_on: null,
        charged: "1200.00",
        paid: "0.00",
        balance: "1200.00",
        deposit_status: "HELD",
        deposit_amount: "1200.00",
      },
    ],
    error: null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  vi.mocked(useIncomeStatement).mockReturnValue({
    data: {
      from: "2026-01-01",
      to: "2026-01-31",
      totalCharged: "1200.00",
      totalCollected: "0.00",
      outstandingBalance: "1200.00",
    },
    error: null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  vi.mocked(useLeaseStatement).mockReturnValue({
    data: undefined,
    error: null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  vi.mocked(useLeasesForStatement).mockReturnValue({
    data: [],
    error: null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  vi.mocked(useOccupancyReport).mockReturnValue({
    data: undefined,
    error: null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  vi.mocked(useMaintenanceReport).mockReturnValue({
    data: undefined,
    error: null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  vi.mocked(useReportExports).mockReturnValue({
    busy: false,
    error: "",
    exportRentRoll: vi.fn(),
    exportIncomeStatement: vi.fn(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
});

it("shows the rent roll by default", () => {
  render(<ReportsPanel org="org" building="building" />);
  expect(screen.getByText(/Jane Tenant/)).toBeInTheDocument();
  expect(screen.getByText(/Balance 1200.00 USD/)).toBeInTheDocument();
});

it("switches to the income statement tab and shows totals", async () => {
  render(<ReportsPanel org="org" building="building" />);
  await userEvent
    .setup()
    .click(screen.getByRole("tab", { name: "Income statement" }));
  expect(
    screen.getByText(/Outstanding balance as of 2026-01-31: 1200.00/),
  ).toBeInTheDocument();
});

it("prompts to select a lease on the statement tab before fetching", async () => {
  render(<ReportsPanel org="org" building="building" />);
  await userEvent
    .setup()
    .click(screen.getByRole("tab", { name: "Lease statement" }));
  expect(
    screen.getByText("Select a lease to view its statement."),
  ).toBeInTheDocument();
});

it("shows the occupancy report", async () => {
  vi.mocked(useOccupancyReport).mockReturnValue({
    data: {
      byStatus: { VACANT: 1, OCCUPIED: 1 },
      totalRentable: 2,
      occupancyRate: 50,
      averageTenancyDays: 30,
    },
    error: null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  render(<ReportsPanel org="org" building="building" />);
  await userEvent.setup().click(screen.getByRole("tab", { name: "Occupancy" }));
  expect(screen.getByText("Occupancy rate: 50%")).toBeInTheDocument();
  expect(screen.getByText(/Average tenancy 30 days/)).toBeInTheDocument();
});

it("shows the maintenance analytics report", async () => {
  vi.mocked(useMaintenanceReport).mockReturnValue({
    data: {
      from: "2026-01-01",
      to: "2026-01-31",
      byStatus: [{ status: "SUBMITTED", count: 3 }],
      averageResolutionHours: 5.5,
      slaComplianceRate: 90,
    },
    error: null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  render(<ReportsPanel org="org" building="building" />);
  await userEvent
    .setup()
    .click(screen.getByRole("tab", { name: "Maintenance" }));
  expect(screen.getByText("SLA compliance: 90%")).toBeInTheDocument();
  expect(
    screen.getByText("Average resolution time: 5.5 hours"),
  ).toBeInTheDocument();
});

it("exports the rent roll to CSV", async () => {
  const exportRentRoll = vi.fn();
  vi.mocked(useReportExports).mockReturnValue({
    busy: false,
    error: "",
    exportRentRoll,
    exportIncomeStatement: vi.fn(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  render(<ReportsPanel org="org" building="building" />);
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Export CSV" }));
  expect(exportRentRoll).toHaveBeenCalled();
});
