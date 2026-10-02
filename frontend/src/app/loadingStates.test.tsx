import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ListingsPanel } from "@/modules/marketing/view/ListingsPanel";
import { ProspectsPanel } from "@/modules/crm/view/ProspectsPanel";
import { AssetsPanel } from "@/modules/assets/view/AssetsPanel";
import { BuildingConfigurationPanel } from "@/modules/buildings/view/BuildingConfigurationPanel";
import { BillingPage } from "@/modules/billing/view/BillingPage";
import { PlatformBillingPanel } from "@/modules/billing/view/PlatformBillingPanel";
import { ReportsPanel } from "@/modules/reporting/view/ReportsPanel";
import {
  useListingSpaces,
  useListings,
} from "@/modules/marketing/viewmodel/useListings";
import {
  useProspectLeases,
  useProspectSpaces,
  useProspects,
} from "@/modules/crm/viewmodel/useProspects";
import {
  useAssetSpaces,
  useAssets,
} from "@/modules/assets/viewmodel/useAssets";
import { useBuildingConfiguration } from "@/modules/buildings/viewmodel/useBuildingConfiguration";
import {
  useBilling,
  usePlatformBilling,
} from "@/modules/billing/viewmodel/useBilling";
import {
  useIncomeStatement,
  useLeasesForStatement,
  useLeaseStatement,
  useMaintenanceReport,
  useOccupancyReport,
  useRentRoll,
  useReportExports,
} from "@/modules/reporting/viewmodel/useReporting";

vi.mock("@/modules/marketing/viewmodel/useListings", () => ({
  useListings: vi.fn(),
  useListingSpaces: vi.fn(),
  useListingDetail: vi.fn(),
}));
vi.mock("@/modules/crm/viewmodel/useProspects", () => ({
  useProspects: vi.fn(),
  useProspectSpaces: vi.fn(),
  useProspectLeases: vi.fn(),
}));
vi.mock("@/modules/screening", () => ({ ScreeningDialog: () => null }));
vi.mock("@/modules/assets/viewmodel/useAssets", () => ({
  useAssets: vi.fn(),
  useAssetSpaces: vi.fn(),
  useAssetDetail: vi.fn(),
}));
vi.mock("@/modules/buildings/viewmodel/useBuildingConfiguration", () => ({
  useBuildingConfiguration: vi.fn(),
}));
vi.mock("@/modules/billing/viewmodel/useBilling", () => ({
  useBilling: vi.fn(),
  usePlatformBilling: vi.fn(),
  useInvoice: vi.fn(() => ({ isLoading: true })),
}));
vi.mock("@/modules/reporting/viewmodel/useReporting", () => ({
  useRentRoll: vi.fn(),
  useIncomeStatement: vi.fn(),
  useLeasesForStatement: vi.fn(),
  useLeaseStatement: vi.fn(),
  useOccupancyReport: vi.fn(),
  useMaintenanceReport: vi.fn(),
  useReportExports: vi.fn(),
}));

const loading = {
  data: undefined,
  isLoading: true,
  isError: false,
  error: null,
  refetch: vi.fn(),
};
const idle = { data: [], isLoading: false, isError: false, error: null };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const as = (value: unknown) => value as any;

beforeEach(() => {
  vi.mocked(useListingSpaces).mockReturnValue(as(idle));
  vi.mocked(useProspectSpaces).mockReturnValue(as(idle));
  vi.mocked(useProspectLeases).mockReturnValue(as(idle));
  vi.mocked(useAssetSpaces).mockReturnValue(as(idle));
});

describe("skeleton loading", () => {
  it("shows list skeletons, not the empty state, while listings load", () => {
    vi.mocked(useListings).mockReturnValue(
      as({ list: loading, busy: false, error: "" }),
    );
    render(<ListingsPanel org="o" building="b" />);
    expect(
      screen.getByRole("status", { name: "Loading listings" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("No listings yet.")).not.toBeInTheDocument();
  });

  it("shows list skeletons, not the empty state, while prospects load", () => {
    vi.mocked(useProspects).mockReturnValue(
      as({ list: loading, busy: false, error: "" }),
    );
    render(<ProspectsPanel org="o" building="b" />);
    expect(
      screen.getByRole("status", { name: "Loading prospects" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("No prospects yet.")).not.toBeInTheDocument();
  });

  it("shows list skeletons, not the empty state, while assets load", () => {
    vi.mocked(useAssets).mockReturnValue(
      as({ list: loading, busy: false, error: "" }),
    );
    render(<AssetsPanel org="o" building="b" />);
    expect(
      screen.getByRole("status", { name: "Loading assets" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("No assets recorded yet."),
    ).not.toBeInTheDocument();
  });

  it("shows level and space placeholders while the building structure loads", () => {
    vi.mocked(useBuildingConfiguration).mockReturnValue(
      as({
        profile: { ...loading, data: undefined },
        levels: loading,
        spaces: loading,
        busy: false,
        error: "",
      }),
    );
    render(<BuildingConfigurationPanel org="o" building="b" owner />);
    expect(
      screen.getByRole("status", { name: "Loading levels" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: "Loading spaces" }),
    ).toBeInTheDocument();
  });

  it("shows a page skeleton while the billing overview loads", () => {
    vi.mocked(useBilling).mockReturnValue(
      as({
        overview: loading,
        invoices: idle,
        plans: idle,
        busy: false,
        error: "",
      }),
    );
    render(<BillingPage org="o" />);
    expect(
      screen.getAllByRole("status", { name: "Loading billing" }).length,
    ).toBeGreaterThan(0);
  });

  it("shows a table skeleton while platform subscriptions load", () => {
    vi.mocked(usePlatformBilling).mockReturnValue(
      as({
        summary: { ...idle, data: undefined },
        plans: idle,
        subscriptions: loading,
        invoices: idle,
        busy: false,
        error: "",
        clearError: vi.fn(),
      }),
    );
    render(<PlatformBillingPanel />);
    expect(
      screen.getByRole("status", { name: "Loading subscriptions" }),
    ).toBeInTheDocument();
  });

  it("shows a table skeleton while the rent roll loads", () => {
    vi.mocked(useRentRoll).mockReturnValue(as(loading));
    vi.mocked(useIncomeStatement).mockReturnValue(as(idle));
    vi.mocked(useLeasesForStatement).mockReturnValue(as(idle));
    vi.mocked(useLeaseStatement).mockReturnValue(as(idle));
    vi.mocked(useOccupancyReport).mockReturnValue(as(idle));
    vi.mocked(useMaintenanceReport).mockReturnValue(as(idle));
    vi.mocked(useReportExports).mockReturnValue(
      as({ busy: false, error: "", exportRentRoll: vi.fn() }),
    );
    render(<ReportsPanel org="o" building="b" />);
    expect(
      screen.getByRole("status", { name: "Loading rent roll" }),
    ).toBeInTheDocument();
  });
});
