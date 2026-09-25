import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode } from "react";
import { beforeEach, it, expect, vi } from "vitest";
import { TenantPortalPage } from "./TenantPortalPage";
import { adminApi } from "@/modules/admin/model/admin";
import {
  useLeases,
  useLeaseDetail,
} from "@/modules/leases/viewmodel/useLeases";
import { useOccupancy } from "@/modules/occupancy/viewmodel/useOccupancy";
import {
  useMaintenance,
  useRequestDetail,
} from "@/modules/maintenance/viewmodel/useMaintenance";

vi.mock("@/modules/admin/model/admin", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/modules/admin/model/admin")>();
  return { ...actual, adminApi: { ...actual.adminApi, buildings: vi.fn() } };
});
vi.mock("@/modules/leases/viewmodel/useLeases", () => ({
  useLeases: vi.fn(),
  useLeaseDetail: vi.fn(),
}));
vi.mock("@/modules/occupancy/viewmodel/useOccupancy", () => ({
  useOccupancy: vi.fn(),
}));
vi.mock("@/modules/maintenance/viewmodel/useMaintenance", () => ({
  useMaintenance: vi.fn(),
  useRequestDetail: vi.fn(),
}));
vi.mock("@/modules/auth/viewmodel/AuthProvider", () => ({
  useAuth: () => ({ profile: { display_name: "Alex Resident" } }),
}));
vi.mock("@/modules/signing", () => ({
  SignaturePanel: () => <div>Signatures</div>,
}));

const buildings = [{ id: "b1", name: "Riverside", code: "RS" }];
const lease = {
  id: "lease-1",
  status: "ACTIVE",
  starts_on: "2026-01-01",
  rent_amount: "1500.00",
  currency: "USD",
  next_charge_on: "2026-02-01",
};

let query: QueryClient;
let payOnline: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.clearAllMocks();
  query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  payOnline = vi.fn().mockResolvedValue(true);
  vi.mocked(adminApi.buildings).mockResolvedValue(buildings);
  vi.mocked(useLeases).mockReturnValue({
    leases: { data: [lease] },
    busy: false,
    error: "",
    payOnline,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  vi.mocked(useLeaseDetail).mockReturnValue({
    data: {
      balance: "250.00",
      charges: [],
      payments: [],
      deposit: null,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  vi.mocked(useOccupancy).mockReturnValue({
    residents: {
      data: [
        {
          id: "resident-1",
          display_name: "Alex Resident",
          phone: null,
          active: true,
          space_id: "space-1",
          starts_on: "2026-01-01",
        },
      ],
    },
    spaces: { data: [{ id: "space-1", name: "Flat 1", code: "F1" }] },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  vi.mocked(useMaintenance).mockReturnValue({
    categories: { data: [] },
    requests: { data: [], isLoading: false, error: null },
    spaces: { data: [{ id: "space-1", name: "Flat 1", code: "F1" }] },
    error: "",
    busy: false,
    submit: vi.fn(),
    close: vi.fn(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  vi.mocked(useRequestDetail).mockReturnValue({
    query: { data: undefined },
    comment: vi.fn(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
});

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={query}>{children}</QueryClientProvider>;
}

it("shows the tenant's lease balance, unit, and maintenance section", async () => {
  render(<TenantPortalPage org="org" />, { wrapper });
  expect(await screen.findByText("Flat 1 · F1")).toBeInTheDocument();
  expect(screen.getByText(/Alex Resident/)).toBeInTheDocument();
  expect(screen.getByText("250.00 USD")).toBeInTheDocument();
  expect(
    screen.getByText("You haven't reported any issues yet."),
  ).toBeInTheDocument();
});

it("hides the building selector when the tenant only has one building", async () => {
  render(<TenantPortalPage org="org" />, { wrapper });
  await screen.findByText("Flat 1 · F1");
  expect(screen.queryByLabelText("Building")).not.toBeInTheDocument();
});

it("shows a building selector when the tenant has more than one building", async () => {
  vi.mocked(adminApi.buildings).mockResolvedValue([
    ...buildings,
    { id: "b2", name: "Harbor View", code: "HV" },
  ]);
  render(<TenantPortalPage org="org" />, { wrapper });
  expect(await screen.findByLabelText("Building")).toBeInTheDocument();
});

it("lets the resident pay their outstanding balance online", async () => {
  render(<TenantPortalPage org="org" />, { wrapper });
  await screen.findByText("Flat 1 · F1");
  const amount = screen.getByLabelText("Amount") as HTMLInputElement;
  expect(amount.value).toBe("250.00");
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Pay now" }));
  expect(payOnline).toHaveBeenCalledWith("lease-1", 250);
});
