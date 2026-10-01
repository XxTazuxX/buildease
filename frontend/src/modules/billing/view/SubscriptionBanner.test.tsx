import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import type { BillingStatus } from "../model/billing";
import { useBillingStatus } from "../viewmodel/useBilling";
import { SubscriptionBanner } from "./SubscriptionBanner";

vi.mock("../viewmodel/useBilling", () => ({ useBillingStatus: vi.fn() }));

function show(status: Partial<BillingStatus>, owner = true) {
  vi.mocked(useBillingStatus).mockReturnValue({
    data: {
      status: "ACTIVE",
      planCode: "STARTER",
      planName: "Starter",
      trialEndsOn: null,
      trialDaysLeft: null,
      writable: true,
      ...status,
    },
  } as ReturnType<typeof useBillingStatus>);
  return render(
    <MemoryRouter>
      <SubscriptionBanner org="org" owner={owner} />
    </MemoryRouter>,
  );
}

it("stays silent for a healthy subscription or an early trial", () => {
  expect(show({}).container).toBeEmptyDOMElement();
  expect(
    show({ status: "TRIALING", trialDaysLeft: 12 }).container,
  ).toBeEmptyDOMElement();
});

it("counts down the last week of a trial with a link for owners", () => {
  show({ status: "TRIALING", trialDaysLeft: 3 });
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Your free trial ends in 3 days.",
  );
  expect(screen.getByRole("link", { name: "Choose a plan" })).toHaveAttribute(
    "href",
    "/organizations/org/billing",
  );
});

it("tells non-owners to contact an owner when the trial has ended", () => {
  show({ status: "TRIALING", trialDaysLeft: 0, writable: false }, false);
  expect(screen.getByRole("alert")).toHaveTextContent(
    /read-only.*Contact an organization owner/,
  );
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});
