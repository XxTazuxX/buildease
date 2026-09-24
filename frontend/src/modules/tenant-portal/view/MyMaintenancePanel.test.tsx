import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, it, expect, vi } from "vitest";
import { MyMaintenancePanel } from "./MyMaintenancePanel";
import {
  useMaintenance,
  useRequestDetail,
} from "@/modules/maintenance/viewmodel/useMaintenance";
import { useOccupancy } from "@/modules/occupancy/viewmodel/useOccupancy";

vi.mock("@/modules/maintenance/viewmodel/useMaintenance", () => ({
  useMaintenance: vi.fn(),
  useRequestDetail: vi.fn(),
}));
vi.mock("@/modules/occupancy/viewmodel/useOccupancy", () => ({
  useOccupancy: vi.fn(),
}));

const mySpace = { id: "space-1", name: "Flat 1", code: "F1" };
const otherSpace = { id: "space-2", name: "Flat 2", code: "F2" };
const request = {
  id: "req-1",
  title: "Leaking tap",
  status: "RESOLVED",
  priority: "MEDIUM",
  suggested_priority: "MEDIUM",
  created_at: "2026-01-01T00:00:00Z",
};

function maintenanceVm(overrides: Record<string, unknown> = {}) {
  return {
    categories: { data: [] },
    requests: { data: [request], isLoading: false, error: null },
    spaces: { data: [mySpace, otherSpace] },
    error: "",
    busy: false,
    submit: vi.fn().mockResolvedValue(true),
    close: vi.fn().mockResolvedValue(true),
    createCategory: vi.fn(),
    triage: vi.fn(),
    start: vi.fn(),
    resolve: vi.fn(),
    ...overrides,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

beforeEach(() => {
  vi.mocked(useMaintenance).mockReturnValue(maintenanceVm());
  vi.mocked(useOccupancy).mockReturnValue({
    residents: { data: [{ id: "resident-1", space_id: "space-1" }] },
    spaces: { data: [mySpace, otherSpace] },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  vi.mocked(useRequestDetail).mockReturnValue({
    query: { data: undefined },
    comment: vi.fn(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
});

it("scopes the report-issue space picker to only the tenant's own assigned space", async () => {
  render(<MyMaintenancePanel org="org" building="building" />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Report issue" }));
  const dialog = screen.getByRole("dialog");
  await user.click(within(dialog).getByLabelText("Space"));
  expect(
    await screen.findByRole("option", { name: "Flat 1 · F1" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("option", { name: "Flat 2 · F2" }),
  ).not.toBeInTheDocument();
});

it("disables reporting an issue when the tenant has no active unit assignment", () => {
  vi.mocked(useOccupancy).mockReturnValue({
    residents: { data: [{ id: "resident-1", space_id: null }] },
    spaces: { data: [mySpace, otherSpace] },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  render(<MyMaintenancePanel org="org" building="building" />);
  expect(screen.getByRole("button", { name: "Report issue" })).toBeDisabled();
  expect(
    screen.getByText(/don.t have an active unit assignment/),
  ).toBeInTheDocument();
});

it("confirms a resolved request via the close action", async () => {
  const vm = maintenanceVm();
  vi.mocked(useMaintenance).mockReturnValue(vm);
  render(<MyMaintenancePanel org="org" building="building" />);
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Confirm resolved" }));
  expect(vm.close).toHaveBeenCalledWith("req-1", true);
});
