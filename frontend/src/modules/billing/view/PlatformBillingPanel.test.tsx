import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { usePlatformBilling } from "../viewmodel/useBilling";
import { PlatformBillingPanel } from "./PlatformBillingPanel";

vi.mock("../viewmodel/useBilling", () => ({
  usePlatformBilling: vi.fn(),
  useInvoice: vi.fn(() => ({ isLoading: true })),
}));

const ok = (data: unknown) => ({
  data,
  isError: false,
  error: null,
  refetch: vi.fn(),
});

const plan = {
  id: "plan-1",
  code: "STARTER",
  name: "Starter",
  description: null,
  monthly_price: 49,
  annual_price: 490,
  currency: "USD",
  max_buildings: 1,
  max_spaces: 50,
  max_staff: null,
  features: ["Reports"],
  trial_days: 14,
  public: true,
  active: true,
  sort_order: 1,
};

type Fns = Record<string, ReturnType<typeof vi.fn>>;
let fns: Fns;

function arrange(subscriptionOverrides: Record<string, unknown> = {}) {
  fns = {
    savePlan: vi.fn().mockResolvedValue(true),
    assign: vi.fn().mockResolvedValue(true),
    createInvoice: vi.fn().mockResolvedValue(true),
    pay: vi.fn().mockResolvedValue(true),
    voidInvoice: vi.fn().mockResolvedValue(true),
    issue: vi.fn().mockResolvedValue(true),
    approve: vi.fn(),
    decline: vi.fn(),
    clearError: vi.fn(),
  };
  vi.mocked(usePlatformBilling).mockReturnValue({
    summary: ok({
      mrr: 0,
      arr: 0,
      subscriptions: { ACTIVE: 0, PAST_DUE: 0, TRIALING: 0 },
      pendingRequests: 0,
      outstanding: 0,
      overdue: 0,
      collectedLast30Days: 0,
      currency: "USD",
    }),
    plans: ok([plan]),
    subscriptions: ok([
      {
        organization_id: "org-1",
        organization_name: "Acme Properties",
        organization_active: true,
        status: "ACTIVE",
        billing_cycle: "MONTHLY",
        trial_ends_on: null,
        current_period_start: "2026-01-01",
        current_period_end: "2026-02-01",
        billing_email: null,
        plan_id: "plan-1",
        plan_code: "STARTER",
        plan_name: "Starter",
        monthly_price: 49,
        annual_price: 490,
        currency: "USD",
        requested_plan_id: null,
        requested_plan_name: null,
        requested_cycle: null,
        requested_at: null,
        ...subscriptionOverrides,
      },
    ]),
    invoices: ok([
      {
        id: "inv-1",
        number: "BE-1",
        organization_name: "Acme Properties",
        due_on: "2026-02-01",
        total: 49,
        currency: "USD",
        status: "ISSUED",
      },
    ]),
    busy: false,
    error: "",
    ...fns,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
}

beforeEach(() => arrange());

const goTo = async (tab: string) => {
  const user = userEvent.setup();
  render(<PlatformBillingPanel />);
  await user.click(screen.getByRole("tab", { name: tab }));
  return user;
};

it("blocks a new plan with a bad code and out-of-range trial days", async () => {
  const user = await goTo("Plans");
  await user.click(screen.getByRole("button", { name: "New plan" }));
  const dialog = await screen.findByRole("dialog");
  await user.type(within(dialog).getByLabelText("Code"), "a");
  await user.type(within(dialog).getByLabelText("Name"), "Pro");
  const trial = within(dialog).getByLabelText("Trial days");
  await user.clear(trial);
  await user.type(trial, "91");
  await user.click(within(dialog).getByRole("button", { name: "Save plan" }));
  expect(
    await within(dialog).findByText("Use 2–40 letters, digits or underscores"),
  ).toBeInTheDocument();
  expect(within(dialog).getByText("Must be at most 90")).toBeInTheDocument();
  expect(fns.savePlan).not.toHaveBeenCalled();
});

it("saves a valid plan with numeric prices, null limits and a features array", async () => {
  const user = await goTo("Plans");
  await user.click(screen.getByRole("button", { name: "New plan" }));
  const dialog = await screen.findByRole("dialog");
  await user.click(within(dialog).getByLabelText("Code"));
  await user.paste("GROWTH");
  await user.click(within(dialog).getByLabelText("Name"));
  await user.paste("Growth");
  const monthly = within(dialog).getByLabelText("Monthly price");
  await user.clear(monthly);
  await user.type(monthly, "99.5");
  await user.click(within(dialog).getByLabelText("Features (one per line)"));
  await user.paste("Reports\nSupport");
  await user.click(within(dialog).getByRole("button", { name: "Save plan" }));
  await waitFor(() => expect(fns.savePlan).toHaveBeenCalledTimes(1));
  const [id, body] = fns.savePlan.mock.calls[0];
  expect(id).toBeNull();
  expect(body).toMatchObject({
    code: "GROWTH",
    name: "Growth",
    monthlyPrice: 99.5,
    annualPrice: 0,
    currency: "USD",
    maxBuildings: null,
    maxSpaces: null,
    maxStaff: null,
    features: ["Reports", "Support"],
    trialDays: 0,
    sortOrder: 10,
  });
}, 20000);

it("requires a trial end date when a subscription is set to trialing", async () => {
  const user = await goTo("Subscriptions");
  await user.click(screen.getByRole("button", { name: "Manage" }));
  const dialog = await screen.findByRole("dialog");
  await user.click(within(dialog).getByLabelText("Status"));
  await user.click(await screen.findByRole("option", { name: "TRIALING" }));
  await user.click(
    within(dialog).getByRole("button", { name: "Save subscription" }),
  );
  expect(
    await within(dialog).findByText("A trial end date is required"),
  ).toBeInTheDocument();
  expect(fns.assign).not.toHaveBeenCalled();
});

it("saves a subscription change with the selected plan and cycle", async () => {
  const user = await goTo("Subscriptions");
  await user.click(screen.getByRole("button", { name: "Manage" }));
  const dialog = await screen.findByRole("dialog");
  await user.click(
    within(dialog).getByRole("button", { name: "Save subscription" }),
  );
  await waitFor(() => expect(fns.assign).toHaveBeenCalledTimes(1));
  expect(fns.assign).toHaveBeenCalledWith("org-1", {
    planId: "plan-1",
    status: "ACTIVE",
    cycle: "MONTHLY",
    trialEndsOn: undefined,
    periodEnd: undefined,
  });
});

it("requires an organization, and a description and amount for a custom invoice", async () => {
  const user = await goTo("Invoices");
  await user.click(screen.getByRole("button", { name: "New invoice" }));
  const dialog = await screen.findByRole("dialog");
  await user.click(
    within(dialog).getByRole("button", { name: "Create draft" }),
  );
  expect(
    await within(dialog).findByText("Select an organization"),
  ).toBeInTheDocument();
  expect(fns.createInvoice).not.toHaveBeenCalled();

  await user.click(within(dialog).getByLabelText("Organization"));
  await user.click(
    await screen.findByRole("option", { name: "Acme Properties" }),
  );
  await user.click(
    within(dialog).getByLabelText("Bill the current plan and period"),
  );
  await user.click(
    within(dialog).getByRole("button", { name: "Create draft" }),
  );
  expect(
    await within(dialog).findByText("A description is required"),
  ).toBeInTheDocument();
  expect(within(dialog).getByText("An amount is required")).toBeInTheDocument();
  expect(fns.createInvoice).not.toHaveBeenCalled();
});

it("drafts a plan-based invoice for the chosen organization", async () => {
  const user = await goTo("Invoices");
  await user.click(screen.getByRole("button", { name: "New invoice" }));
  const dialog = await screen.findByRole("dialog");
  await user.click(within(dialog).getByLabelText("Organization"));
  await user.click(
    await screen.findByRole("option", { name: "Acme Properties" }),
  );
  await user.click(
    within(dialog).getByRole("button", { name: "Create draft" }),
  );
  await waitFor(() => expect(fns.createInvoice).toHaveBeenCalledTimes(1));
  expect(fns.createInvoice.mock.calls[0][0]).toMatchObject({
    organizationId: "org-1",
    fromPlan: true,
    amount: undefined,
    tax: undefined,
  });
});

it("collects payment details in a validated dialog and defaults the method", async () => {
  const user = await goTo("Invoices");
  await user.click(screen.getByRole("button", { name: "Mark paid" }));
  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).getByLabelText("Payment method")).toHaveValue(
    "Bank transfer",
  );
  await user.click(
    within(dialog).getByLabelText("Payment reference (optional)"),
  );
  await user.paste("r".repeat(121));
  await user.click(within(dialog).getByRole("button", { name: "Mark paid" }));
  expect(
    await within(dialog).findByText("Use at most 120 characters"),
  ).toBeInTheDocument();
  expect(fns.pay).not.toHaveBeenCalled();

  const reference = within(dialog).getByLabelText(
    "Payment reference (optional)",
  );
  await user.clear(reference);
  await user.type(reference, "TX-1");
  await user.click(within(dialog).getByRole("button", { name: "Mark paid" }));
  await waitFor(() =>
    expect(fns.pay).toHaveBeenCalledWith("inv-1", "Bank transfer", "TX-1"),
  );
});

it("lets an invoice be voided with an optional reason", async () => {
  const user = await goTo("Invoices");
  await user.click(screen.getByRole("button", { name: "Void" }));
  const dialog = await screen.findByRole("dialog");
  await user.click(
    within(dialog).getByLabelText("Reason for voiding (optional)"),
  );
  await user.paste("r".repeat(1001));
  await user.click(
    within(dialog).getByRole("button", { name: "Void invoice" }),
  );
  expect(
    await within(dialog).findByText("Use at most 1000 characters"),
  ).toBeInTheDocument();
  expect(fns.voidInvoice).not.toHaveBeenCalled();

  const reason = within(dialog).getByLabelText("Reason for voiding (optional)");
  await user.clear(reason);
  await user.click(
    within(dialog).getByRole("button", { name: "Void invoice" }),
  );
  await waitFor(() =>
    expect(fns.voidInvoice).toHaveBeenCalledWith("inv-1", ""),
  );
});
