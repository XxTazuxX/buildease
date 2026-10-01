import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { QueryError } from "./QueryError";

it("renders nothing while every query is healthy", () => {
  const { container } = render(
    <QueryError
      queries={[{ error: null, isError: false, refetch: vi.fn() }]}
    />,
  );
  expect(container).toBeEmptyDOMElement();
});

it("shows the first failure and retries only failed queries", async () => {
  const healthy = { error: null, isError: false, refetch: vi.fn() };
  const failed = {
    error: new Error("Server unavailable"),
    isError: true,
    refetch: vi.fn(),
  };
  render(<QueryError queries={[healthy, failed]} what="your lease" />);
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Could not load your lease: Server unavailable",
  );
  await userEvent.setup().click(screen.getByRole("button", { name: "Retry" }));
  expect(failed.refetch).toHaveBeenCalled();
  expect(healthy.refetch).not.toHaveBeenCalled();
});
