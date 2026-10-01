import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, it, expect, vi } from "vitest";
import { MaintenancePanel } from "./MaintenancePanel";
import { useMaintenance, useRequestDetail } from "../viewmodel/useMaintenance";

vi.mock("../viewmodel/useMaintenance", () => ({
  useMaintenance: vi.fn(),
  useRequestDetail: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(useRequestDetail).mockReturnValue({
    query: { data: undefined, isLoading: false, error: null },
    busy: false,
    error: "",
    comment: vi.fn(),
    addWorkLog: vi.fn(),
    updateWorkCosts: vi.fn(),
    uploadPhoto: vi.fn(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
});

const category = {
  id: "cat-1",
  name: "Plumbing",
  default_priority: "MEDIUM",
  response_minutes: 240,
  resolution_minutes: 2880,
  active: true,
};

function baseVm(overrides: Record<string, unknown> = {}) {
  return {
    categories: { data: [category], isLoading: false, error: null },
    requests: { data: [], isLoading: false, error: null },
    spaces: { data: [] },
    vendors: { data: [] },
    error: "",
    busy: false,
    submit: vi.fn(),
    createCategory: vi.fn().mockResolvedValue(true),
    updateCategory: vi.fn().mockResolvedValue(true),
    triage: vi.fn(),
    start: vi.fn(),
    resolve: vi.fn(),
    close: vi.fn(),
    assignStaff: vi.fn().mockResolvedValue(true),
    assignVendor: vi.fn().mockResolvedValue(true),
    createVendor: vi.fn().mockResolvedValue(true),
    ...overrides,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

beforeEach(() => {
  vi.mocked(useMaintenance).mockReturnValue(baseVm());
});

it("populates the form for editing and saves changes via updateCategory", async () => {
  const vm = baseVm();
  vi.mocked(useMaintenance).mockReturnValue(vm);
  render(<MaintenancePanel org="org" building="building" canManage={true} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Categories" }));
  const dialog = screen.getByRole("dialog");
  await user.click(within(dialog).getByRole("button", { name: "Edit" }));

  expect(within(dialog).getByLabelText("Category name")).toHaveValue(
    "Plumbing",
  );
  expect(within(dialog).getByLabelText("Response target (hours)")).toHaveValue(
    4,
  );
  expect(
    within(dialog).getByRole("button", { name: "Save changes" }),
  ).toBeInTheDocument();

  await user.clear(within(dialog).getByLabelText("Category name"));
  await user.type(
    within(dialog).getByLabelText("Category name"),
    "Plumbing & Water",
  );
  await user.click(
    within(dialog).getByRole("button", { name: "Save changes" }),
  );

  expect(vm.updateCategory).toHaveBeenCalledWith("cat-1", {
    name: "Plumbing & Water",
    responseHours: 4,
    resolutionHours: 48,
  });
});

it("rejects category targets outside the allowed ranges", async () => {
  const vm = baseVm();
  vi.mocked(useMaintenance).mockReturnValue(vm);
  render(<MaintenancePanel org="org" building="building" canManage={true} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Categories" }));
  const dialog = screen.getByRole("dialog");
  await user.click(
    within(dialog).getByRole("button", { name: "Create category" }),
  );
  expect(await within(dialog).findByText("Required")).toBeInTheDocument();
  await user.type(within(dialog).getByLabelText("Category name"), "HVAC");
  const response = within(dialog).getByLabelText("Response target (hours)");
  await user.clear(response);
  await user.type(response, "8761");
  await user.click(
    within(dialog).getByRole("button", { name: "Create category" }),
  );
  expect(
    await within(dialog).findByText("Must be at most 8760"),
  ).toBeInTheDocument();
  expect(vm.createCategory).not.toHaveBeenCalled();
});

it("rejects a resolution target shorter than the response target", async () => {
  const vm = baseVm();
  vi.mocked(useMaintenance).mockReturnValue(vm);
  render(<MaintenancePanel org="org" building="building" canManage={true} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Categories" }));
  const dialog = screen.getByRole("dialog");
  await user.type(within(dialog).getByLabelText("Category name"), "HVAC");
  const resolution = within(dialog).getByLabelText("Resolution target (hours)");
  await user.clear(resolution);
  await user.type(resolution, "2");
  await user.click(
    within(dialog).getByRole("button", { name: "Create category" }),
  );
  expect(
    await within(dialog).findByText(
      "Resolution target must not precede the response target",
    ),
  ).toBeInTheDocument();
  expect(vm.createCategory).not.toHaveBeenCalled();
});

it("validates a vendor's email and linked account ID", async () => {
  const vm = baseVm();
  vi.mocked(useMaintenance).mockReturnValue(vm);
  render(<MaintenancePanel org="org" building="building" canManage={true} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Vendors" }));
  const dialog = screen.getByRole("dialog");
  await user.click(within(dialog).getByRole("button", { name: "Add vendor" }));
  expect(await within(dialog).findByText("Required")).toBeInTheDocument();
  await user.type(within(dialog).getByLabelText("Vendor name"), "Acme");
  await user.type(within(dialog).getByLabelText("Email (optional)"), "nope");
  await user.type(
    within(dialog).getByLabelText("Link to account ID (optional)"),
    "not-a-uuid",
  );
  await user.click(within(dialog).getByRole("button", { name: "Add vendor" }));
  expect(
    await within(dialog).findByText("Enter a valid email address"),
  ).toBeInTheDocument();
  expect(
    within(dialog).getByText("Enter a valid account ID"),
  ).toBeInTheDocument();
  expect(vm.createVendor).not.toHaveBeenCalled();
});

it("requires a vendor before assigning and rejects a negative estimate", async () => {
  const vm = baseVm({
    requests: {
      data: [
        {
          id: "req-1",
          title: "Leaking tap",
          impact: "MEDIUM",
          danger: false,
          suggested_priority: "MEDIUM",
          priority: "MEDIUM",
          status: "TRIAGED",
          resolution_due_at: null,
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
      isLoading: false,
      error: null,
    },
    vendors: { data: [{ id: "vendor-1", name: "Acme Plumbing" }] },
  });
  vi.mocked(useMaintenance).mockReturnValue(vm);
  render(<MaintenancePanel org="org" building="building" canManage={true} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Assign" }));
  const dialog = screen.getByRole("dialog");
  const estimate = within(dialog).getByLabelText("Estimated cost (optional)");
  await user.type(estimate, "-5");
  await user.click(within(dialog).getByRole("button", { name: "Assign" }));
  expect(
    await within(dialog).findByText("Enter a valid amount"),
  ).toBeInTheDocument();
  await user.clear(estimate);
  await user.click(within(dialog).getByRole("button", { name: "Assign" }));
  expect(
    await within(dialog).findByText("Select a vendor"),
  ).toBeInTheDocument();
  expect(vm.assignVendor).not.toHaveBeenCalled();
});

it("collects the resolution summary in a validated dialog", async () => {
  const resolve = vi.fn().mockResolvedValue(true);
  const vm = baseVm({
    resolve,
    requests: {
      data: [
        {
          id: "req-1",
          title: "Leaking tap",
          impact: "MEDIUM",
          danger: false,
          suggested_priority: "MEDIUM",
          priority: "MEDIUM",
          status: "IN_PROGRESS",
          resolution_due_at: null,
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
      isLoading: false,
      error: null,
    },
  });
  vi.mocked(useMaintenance).mockReturnValue(vm);
  render(<MaintenancePanel org="org" building="building" canManage={false} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Resolve" }));
  const dialog = await screen.findByRole("dialog");
  await user.click(within(dialog).getByRole("button", { name: "Resolve" }));
  expect(await within(dialog).findByText("Required")).toBeInTheDocument();
  expect(resolve).not.toHaveBeenCalled();
  await user.type(
    within(dialog).getByLabelText("Resolution summary"),
    "Replaced the washer",
  );
  await user.click(within(dialog).getByRole("button", { name: "Resolve" }));
  await waitFor(() =>
    expect(resolve).toHaveBeenCalledWith("req-1", "Replaced the washer"),
  );
});

it("requires a reason to cancel a request", async () => {
  const cancel = vi.fn().mockResolvedValue(true);
  const vm = baseVm({
    cancel,
    requests: {
      data: [
        {
          id: "req-1",
          title: "Leaking tap",
          impact: "MEDIUM",
          danger: false,
          suggested_priority: "MEDIUM",
          priority: "MEDIUM",
          status: "SUBMITTED",
          resolution_due_at: null,
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
      isLoading: false,
      error: null,
    },
  });
  vi.mocked(useMaintenance).mockReturnValue(vm);
  render(<MaintenancePanel org="org" building="building" canManage={true} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  const dialog = await screen.findByRole("dialog");
  await user.click(
    within(dialog).getByRole("button", { name: "Cancel request" }),
  );
  expect(await within(dialog).findByText("Required")).toBeInTheDocument();
  expect(cancel).not.toHaveBeenCalled();
  await user.type(
    within(dialog).getByLabelText("Reason for cancelling"),
    "Duplicate",
  );
  await user.click(
    within(dialog).getByRole("button", { name: "Cancel request" }),
  );
  await waitFor(() =>
    expect(cancel).toHaveBeenCalledWith("req-1", "Duplicate"),
  );
});

it("cancels an in-progress edit without calling updateCategory", async () => {
  const vm = baseVm();
  vi.mocked(useMaintenance).mockReturnValue(vm);
  render(<MaintenancePanel org="org" building="building" canManage={true} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Categories" }));
  const dialog = screen.getByRole("dialog");
  await user.click(within(dialog).getByRole("button", { name: "Edit" }));
  await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

  expect(within(dialog).getByLabelText("Category name")).toHaveValue("");
  expect(
    within(dialog).getByRole("button", { name: "Create category" }),
  ).toBeInTheDocument();
  expect(vm.updateCategory).not.toHaveBeenCalled();
});

it("assigns a triaged request to a vendor", async () => {
  const vm = baseVm({
    requests: {
      data: [
        {
          id: "req-1",
          title: "Leaking tap",
          impact: "MEDIUM",
          danger: false,
          suggested_priority: "MEDIUM",
          priority: "MEDIUM",
          status: "TRIAGED",
          resolution_due_at: null,
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
      isLoading: false,
      error: null,
    },
    vendors: { data: [{ id: "vendor-1", name: "Acme Plumbing" }] },
  });
  vi.mocked(useMaintenance).mockReturnValue(vm);
  render(<MaintenancePanel org="org" building="building" canManage={true} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Assign" }));
  const dialog = screen.getByRole("dialog");
  await user.click(within(dialog).getByLabelText("Vendor"));
  await user.click(
    await screen.findByRole("option", { name: "Acme Plumbing" }),
  );
  await user.click(within(dialog).getByRole("button", { name: "Assign" }));
  expect(vm.assignVendor).toHaveBeenCalledWith("req-1", "vendor-1", undefined);
});

it("adds a new vendor from the vendors dialog", async () => {
  const vm = baseVm();
  vi.mocked(useMaintenance).mockReturnValue(vm);
  render(<MaintenancePanel org="org" building="building" canManage={true} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Vendors" }));
  const dialog = screen.getByRole("dialog");
  await user.type(
    within(dialog).getByLabelText("Vendor name"),
    "Acme Plumbing",
  );
  await user.click(within(dialog).getByRole("button", { name: "Add vendor" }));
  expect(vm.createVendor).toHaveBeenCalledWith({
    name: "Acme Plumbing",
    email: undefined,
    phone: undefined,
    accountId: undefined,
  });
});
