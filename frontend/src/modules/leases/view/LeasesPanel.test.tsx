import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, it, expect, vi } from "vitest";
import { LeasesPanel } from "./LeasesPanel";
import { useLeaseDetail, useLeases } from "../viewmodel/useLeases";

vi.mock("../viewmodel/useLeases", () => ({
  useLeases: vi.fn(),
  useLeaseDetail: vi.fn(),
}));

const resident = {
  id: "resident-1",
  display_name: "Alex Resident",
  active: true,
};
const space = { id: "space-1", name: "Flat 1", code: "F1", status: "VACANT" };
const draftLease = {
  id: "lease-1",
  resident_id: "resident-1",
  space_id: "space-1",
  status: "DRAFT",
  starts_on: "2026-01-01",
  rent_amount: "1200.00",
  currency: "USD",
};

function baseVm(overrides: Record<string, unknown> = {}) {
  return {
    leases: { data: [draftLease], error: null },
    residents: { data: [resident] },
    spaces: { data: [space] },
    busy: false,
    error: "",
    create: vi.fn().mockResolvedValue(true),
    activate: vi.fn().mockResolvedValue(true),
    cancel: vi.fn().mockResolvedValue(true),
    end: vi.fn().mockResolvedValue(true),
    recordPayment: vi.fn().mockResolvedValue(true),
    recordDeposit: vi.fn().mockResolvedValue(true),
    refundDeposit: vi.fn().mockResolvedValue(true),
    forfeitDeposit: vi.fn().mockResolvedValue(true),
    ...overrides,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

beforeEach(() => {
  vi.mocked(useLeases).mockReturnValue(baseVm());
  vi.mocked(useLeaseDetail).mockReturnValue({
    isLoading: false,
    data: {
      status: "DRAFT",
      balance: "0.00",
      currency: "USD",
      charges: [],
      payments: [],
      deposit: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
});

it("hides manager and finance-only controls for a plain member", async () => {
  render(
    <LeasesPanel
      org="org"
      building="building"
      canManage={false}
      canManageFinance={false}
    />,
  );
  expect(
    screen.queryByRole("button", { name: "New lease" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Activate" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Cancel" }),
  ).not.toBeInTheDocument();

  await userEvent.setup().click(screen.getByRole("button", { name: "View" }));
  expect(
    screen.queryByRole("button", { name: "Record payment" }),
  ).not.toBeInTheDocument();
  expect(screen.getByText("No deposit recorded.")).toBeInTheDocument();
});

it("shows lifecycle controls for a manager and activates a draft lease", async () => {
  const vm = baseVm();
  vi.mocked(useLeases).mockReturnValue(vm);
  render(
    <LeasesPanel
      org="org"
      building="building"
      canManage={true}
      canManageFinance={false}
    />,
  );
  expect(screen.getByRole("button", { name: "New lease" })).toBeInTheDocument();
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Activate" }));
  expect(vm.activate).toHaveBeenCalledWith("lease-1");
});

it("creates a lease with the typed values when an owner submits the new-lease form", async () => {
  const vm = baseVm({ leases: { data: [], error: null } });
  vi.mocked(useLeases).mockReturnValue(vm);
  render(
    <LeasesPanel
      org="org"
      building="building"
      canManage={true}
      canManageFinance={true}
    />,
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "New lease" }));

  const dialog = screen.getByRole("dialog");
  await user.click(within(dialog).getByLabelText("Resident"));
  await user.click(
    await screen.findByRole("option", { name: "Alex Resident" }),
  );
  await user.click(within(dialog).getByLabelText("Rentable space"));
  await user.click(await screen.findByRole("option", { name: "Flat 1 · F1" }));
  await user.type(within(dialog).getByLabelText("Starts on"), "2026-02-01");
  await user.type(within(dialog).getByLabelText("Monthly rent"), "1500");
  await user.type(
    within(dialog).getByLabelText("First charge on"),
    "2026-02-01",
  );
  await user.click(
    within(dialog).getByRole("button", { name: "Create lease" }),
  );

  expect(vm.create).toHaveBeenCalledWith(
    expect.objectContaining({
      residentId: "resident-1",
      spaceId: "space-1",
      startsOn: "2026-02-01",
      rentAmount: 1500,
      firstChargeOn: "2026-02-01",
    }),
  );
});
