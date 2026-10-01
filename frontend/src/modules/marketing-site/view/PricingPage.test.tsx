import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { usePublicPlans } from "@/modules/billing";
import { LandingPage } from "./LandingPage";
import { PricingPage } from "./PricingPage";

vi.mock("@/modules/billing", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/billing")>();
  return { ...actual, usePublicPlans: vi.fn() };
});

beforeEach(() => {
  vi.mocked(usePublicPlans).mockReturnValue({
    isLoading: false,
    isError: false,
    data: [
      {
        id: "p1",
        code: "STARTER",
        name: "Starter",
        description: "For one property",
        monthly_price: 49,
        annual_price: 490,
        currency: "USD",
        max_buildings: 1,
        max_spaces: 50,
        max_staff: 5,
        features: ["Tenant portal"],
        trial_days: 0,
        public: true,
        active: true,
        sort_order: 1,
      },
    ],
  } as unknown as ReturnType<typeof usePublicPlans>);
});

it("lists public plans with limits and sends visitors to sign up", async () => {
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={["/pricing"]}>
      <Routes>
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/register" element={<div>Registration form</div>} />
      </Routes>
    </MemoryRouter>,
  );
  expect(screen.getByText("Starter")).toBeInTheDocument();
  expect(screen.getByText("1 building")).toBeInTheDocument();
  expect(screen.getByText("Tenant portal")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: /annual/i }));
  expect(screen.getByText(/\/ year/)).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Start free trial" }));
  expect(await screen.findByText("Registration form")).toBeInTheDocument();
});

it("renders the landing page with a trial call to action", () => {
  render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>,
  );
  expect(
    screen.getByRole("heading", {
      name: "Run every building from one calm workspace.",
    }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: "Start your 14-day free trial" }),
  ).toHaveAttribute("href", "/register");
});
