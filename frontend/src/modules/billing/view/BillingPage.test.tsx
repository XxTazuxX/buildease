import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import type { BillingOverview, Plan } from "../model/billing";
import { useBilling } from "../viewmodel/useBilling";
import { BillingPage } from "./BillingPage";

vi.mock("../viewmodel/useBilling", () => ({
  useBilling: vi.fn(),
  useInvoice: vi.fn(() => ({ isLoading: true })),
}));

const plan = (code: string, id: string, price: number): Plan => ({
  id,
  code,
  name: code.charAt(0) + code.slice(1).toLowerCase(),
  description: null,
  monthly_price: price,
  annual_price: price * 10,
  currency: "USD",
  max_buildings: 1,
  max_spaces: 50,
  max_staff: 5,
  features: [],
  trial_days: 0,
  public: true,
  active: true,
  sort_order: 1,
});

const overview: BillingOverview = {
  organization_id: "org",
  plan_id: "trial",
  plan_code: "TRIAL",
  plan_name: "Free trial",
  status: "TRIALING",
  billing_cycle: "MONTHLY",
  trial_ends_on: "2026-10-10",
  trial_days_left: 9,
  current_period_start: "2026-09-26",
  current_period_end: "2026-10-10",
  monthly_price: 0,
  annual_price: 0,
  currency: "USD",
  features: [],
  billing_email: null,
  billing_name: null,
  billing_address: null,
  tax_id: null,
  requested_plan_id: null,
  requested_cycle: null,
  requested_at: null,
  requested_plan: null,
  writable: true,
  usage: { buildings: 1, spaces: 20, staff: 2 },
  limits: { buildings: 1, spaces: 25, staff: 5 },
};

let requestPlan: ReturnType<typeof vi.fn>;
beforeEach(() => {
  requestPlan = vi.fn().mockResolvedValue(true);
  vi.mocked(useBilling).mockReturnValue({
    overview: { data: overview, isError: false, error: null, refetch: vi.fn() },
    invoices: {
      data: [
        {
          id: "inv-1",
          number: "BE-2026-000001",
          issued_on: "2026-09-01",
          due_on: "2026-09-15",
          total: 49,
          currency: "USD",
          status: "ISSUED",
        },
      ],
      isError: false,
      error: null,
      refetch: vi.fn(),
    },
    plans: { data: [plan("STARTER", "starter", 49)] },
    busy: false,
    error: "",
    updateProfile: vi.fn(),
    requestPlan,
    withdrawRequest: vi.fn(),
  } as unknown as ReturnType<typeof useBilling>);
});

it("shows trial status, usage against limits and invoices", () => {
  render(<BillingPage org="org" />);
  expect(screen.getByText(/free trial ends in 9 days/i)).toBeInTheDocument();
  expect(screen.getByText("1 / 1")).toBeInTheDocument();
  expect(screen.getByText("20 / 25")).toBeInTheDocument();
  expect(screen.getByText("BE-2026-000001")).toBeInTheDocument();
});

it("validates the billing email and field lengths before saving the profile", async () => {
  const updateProfile = vi.fn().mockResolvedValue(true);
  vi.mocked(useBilling).mockReturnValue({
    ...vi.mocked(useBilling)("org"),
    updateProfile,
  } as unknown as ReturnType<typeof useBilling>);
  const user = userEvent.setup();
  render(<BillingPage org="org" />);
  await user.type(screen.getByLabelText("Billing email"), "nope");
  await user.click(screen.getByLabelText("Tax / VAT ID"));
  await user.paste("t".repeat(61));
  await user.click(
    screen.getByRole("button", { name: "Save billing details" }),
  );
  expect(
    await screen.findByText("Enter a valid email address"),
  ).toBeInTheDocument();
  expect(screen.getByText("Use at most 60 characters")).toBeInTheDocument();
  expect(updateProfile).not.toHaveBeenCalled();
});

it("saves a valid billing profile and confirms it", async () => {
  const updateProfile = vi.fn().mockResolvedValue(true);
  vi.mocked(useBilling).mockReturnValue({
    ...vi.mocked(useBilling)("org"),
    updateProfile,
  } as unknown as ReturnType<typeof useBilling>);
  const user = userEvent.setup();
  render(<BillingPage org="org" />);
  await user.type(screen.getByLabelText("Billing email"), "billing@acme.test");
  await user.type(screen.getByLabelText("Company name"), "Acme");
  await user.click(
    screen.getByRole("button", { name: "Save billing details" }),
  );
  expect(await screen.findByText("Saved")).toBeInTheDocument();
  expect(updateProfile).toHaveBeenCalledWith({
    billingEmail: "billing@acme.test",
    billingName: "Acme",
    billingAddress: "",
    taxId: "",
  });
});

it("requests a plan for the chosen billing cycle", async () => {
  const user = userEvent.setup();
  render(<BillingPage org="org" />);
  await user.click(screen.getByRole("button", { name: /annual/i }));
  await user.click(screen.getByRole("button", { name: "Request Starter" }));
  expect(requestPlan).toHaveBeenCalledWith("starter", "ANNUAL");
});
