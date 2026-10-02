import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, it, expect, vi } from "vitest";
import { LeasesPanel } from "./LeasesPanel";
import { useLeaseDetail, useLeases } from "../viewmodel/useLeases";

vi.mock("../viewmodel/useLeases", () => ({
  useLeases: vi.fn(),
  useLeaseDetail: vi.fn(),
}));
vi.mock("@/modules/auth/viewmodel/AuthProvider", () => ({
  useAuth: () => ({ profile: { display_name: "Owner Name" } }),
}));
vi.mock("@/modules/signing", () => ({
  SignaturePanel: () => <div>Signatures</div>,
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

it("asks for confirmation before cancelling a draft lease", async () => {
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
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).getByText(/cannot be reactivated/)).toBeVisible();
  await user.click(within(dialog).getByRole("button", { name: "Keep lease" }));
  expect(vm.cancel).not.toHaveBeenCalled();

  await user.click(screen.getByRole("button", { name: "Cancel" }));
  await user.click(
    within(await screen.findByRole("dialog")).getByRole("button", {
      name: "Cancel lease",
    }),
  );
  await waitFor(() => expect(vm.cancel).toHaveBeenCalledWith("lease-1"));
});

it("asks for confirmation before forfeiting a deposit", async () => {
  const vm = baseVm();
  vi.mocked(useLeases).mockReturnValue(vm);
  vi.mocked(useLeaseDetail).mockReturnValue({
    isLoading: false,
    data: {
      status: "ACTIVE",
      balance: "0.00",
      currency: "USD",
      charges: [],
      payments: [],
      deposit: { status: "HELD", amount: "500.00" },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  render(
    <LeasesPanel
      org="org"
      building="building"
      canManage={true}
      canManageFinance={true}
    />,
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "View" }));
  await user.click(
    within(await screen.findByRole("dialog")).getByRole("button", {
      name: "Forfeit deposit",
    }),
  );
  const confirm = await screen.findByRole("dialog");
  expect(within(confirm).getByText(/will not be refunded/)).toBeVisible();
  expect(vm.forfeitDeposit).not.toHaveBeenCalled();
  await user.click(
    within(confirm).getByRole("button", { name: "Keep deposit" }),
  );
  expect(vm.forfeitDeposit).not.toHaveBeenCalled();

  await user.click(
    within(await screen.findByRole("dialog")).getByRole("button", {
      name: "Forfeit deposit",
    }),
  );
  await user.click(
    within(await screen.findByRole("dialog")).getByRole("button", {
      name: "Forfeit deposit",
    }),
  );
  await waitFor(() =>
    expect(vm.forfeitDeposit).toHaveBeenCalledWith(
      "lease-1",
      "Forfeited by owner decision",
    ),
  );
});

it("blocks an empty new lease and shows every required error", async () => {
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
  await user.click(
    within(dialog).getByRole("button", { name: "Create lease" }),
  );
  expect(
    await within(dialog).findByText("Select a resident"),
  ).toBeInTheDocument();
  expect(within(dialog).getByText("Select a space")).toBeInTheDocument();
  expect(within(dialog).getAllByText("Required")).toHaveLength(3);
  expect(vm.create).not.toHaveBeenCalled();
});

it("flags a first charge date before the lease start", async () => {
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
  await user.type(within(dialog).getByLabelText("Monthly rent"), "1500.555");
  await user.type(
    within(dialog).getByLabelText("First charge on"),
    "2026-01-15",
  );
  await user.click(
    within(dialog).getByRole("button", { name: "Create lease" }),
  );
  expect(
    await within(dialog).findByText("Use at most 2 decimal places"),
  ).toBeInTheDocument();
  expect(vm.create).not.toHaveBeenCalled();
  const rent = within(dialog).getByLabelText("Monthly rent");
  await user.clear(rent);
  await user.type(rent, "1500");
  await user.click(
    within(dialog).getByRole("button", { name: "Create lease" }),
  );
  expect(
    await within(dialog).findByText(
      "First charge date cannot precede the lease start",
    ),
  ).toBeInTheDocument();
  expect(vm.create).not.toHaveBeenCalled();
});

it("rejects ending a lease before it started", async () => {
  const vm = baseVm({
    leases: { data: [{ ...draftLease, status: "ACTIVE" }], error: null },
  });
  vi.mocked(useLeases).mockReturnValue(vm);
  render(
    <LeasesPanel
      org="org"
      building="building"
      canManage={true}
      canManageFinance={false}
    />,
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "End lease" }));
  const dialog = await screen.findByRole("dialog");
  const endsOn = within(dialog).getByLabelText("Ends on");
  await user.clear(endsOn);
  await user.type(endsOn, "2025-12-31");
  await user.click(within(dialog).getByRole("button", { name: "End lease" }));
  expect(
    await within(dialog).findByText(
      "End date cannot be before the lease start",
    ),
  ).toBeInTheDocument();
  expect(vm.end).not.toHaveBeenCalled();
});

it("validates a recorded payment and refund inside the lease detail", async () => {
  const vm = baseVm();
  vi.mocked(useLeases).mockReturnValue(vm);
  vi.mocked(useLeaseDetail).mockReturnValue({
    isLoading: false,
    data: {
      status: "ACTIVE",
      balance: "0.00",
      currency: "USD",
      charges: [],
      payments: [],
      deposit: { status: "HELD", amount: "500.00" },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  render(
    <LeasesPanel
      org="org"
      building="building"
      canManage={true}
      canManageFinance={true}
    />,
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "View" }));
  const dialog = await screen.findByRole("dialog");
  await user.click(
    within(dialog).getByRole("button", { name: "Record payment" }),
  );
  expect(await within(dialog).findAllByText("Required")).toHaveLength(2);
  expect(vm.recordPayment).not.toHaveBeenCalled();

  await user.type(within(dialog).getByLabelText("Refund amount"), "600");
  await user.type(within(dialog).getByLabelText("Refunded on"), "2026-03-01");
  await user.click(
    within(dialog).getByRole("button", { name: "Refund deposit" }),
  );
  expect(
    await within(dialog).findByText("Refund cannot exceed the held deposit"),
  ).toBeInTheDocument();
  expect(vm.refundDeposit).not.toHaveBeenCalled();
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
