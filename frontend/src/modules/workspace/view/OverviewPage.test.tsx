import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { useDashboard } from "../viewmodel/useDashboard";
import { OverviewPage } from "./OverviewPage";

vi.mock("../viewmodel/useDashboard", () => ({ useDashboard: vi.fn() }));

beforeEach(() => {
  vi.mocked(useDashboard).mockReturnValue({
    data: {
      properties: {
        building_count: 2,
        space_count: 18,
        occupied_space_count: 12,
        vacant_space_count: 6,
      },
      people: {
        active_member_count: 9,
        active_resident_count: 7,
        active_assignment_count: 6,
      },
      finance: {
        active_lease_count: 5,
        balance_by_currency: [{ currency: "USD", amount: "750.00" }],
      },
      maintenance: { open_request_count: 4, overdue_request_count: 1 },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
});

it("shows the live organization summary and building-aware links", () => {
  render(
    <MemoryRouter>
      <OverviewPage
        org="org-1"
        building="building-1"
        displayName="Morgan Owner"
        pending={[]}
        onAccept={vi.fn()}
      />
    </MemoryRouter>,
  );

  expect(screen.getByText("Hello, Morgan Owner.")).toBeInTheDocument();
  expect(screen.getByText("18 spaces · 12 occupied")).toBeInTheDocument();
  expect(screen.getByText("750.00 USD")).toBeInTheDocument();
  expect(screen.getByText("1 overdue")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Open properties" })).toHaveAttribute(
    "href",
    "/organizations/org-1/properties?building=building-1",
  );
});

it("does not expose links for restricted dashboard sections", () => {
  vi.mocked(useDashboard).mockReturnValue({
    data: {
      properties: {
        building_count: 1,
        space_count: 2,
        occupied_space_count: 0,
        vacant_space_count: 2,
      },
      people: null,
      finance: null,
      maintenance: null,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  render(
    <MemoryRouter>
      <OverviewPage
        org="org-1"
        building="building-1"
        displayName="Staff User"
        pending={[]}
        onAccept={vi.fn()}
      />
    </MemoryRouter>,
  );

  expect(
    screen.queryByRole("link", { name: "Open people" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("link", { name: "Open finance" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("link", { name: "Open maintenance" }),
  ).not.toBeInTheDocument();
});
