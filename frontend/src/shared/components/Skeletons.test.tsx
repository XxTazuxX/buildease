import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import {
  CardGridSkeleton,
  DetailSkeleton,
  ListSkeleton,
  PageSkeleton,
  TableSkeleton,
} from "./Skeletons";

it("announces each placeholder as a single busy status region with its label", () => {
  render(
    <>
      <ListSkeleton label="Loading assets" />
      <CardGridSkeleton label="Loading spaces" />
      <TableSkeleton label="Loading invoices" />
      <DetailSkeleton label="Loading lease" />
    </>,
  );
  for (const name of [
    "Loading assets",
    "Loading spaces",
    "Loading invoices",
    "Loading lease",
  ]) {
    const region = screen.getByRole("status", { name });
    expect(region).toHaveAttribute("aria-busy", "true");
  }
});

it("renders the requested number of list rows", () => {
  const { container } = render(<ListSkeleton rows={5} />);
  expect(container.querySelectorAll(".MuiPaper-outlined")).toHaveLength(5);
});

it("renders the requested number of table cells", () => {
  const { container } = render(<TableSkeleton rows={2} columns={3} />);
  expect(container.querySelectorAll(".MuiSkeleton-root")).toHaveLength(6);
});

it("labels a page skeleton for assistive technology", () => {
  render(<PageSkeleton label="Loading workspace" />);
  expect(
    screen.getAllByRole("status", { name: "Loading workspace" }).length,
  ).toBeGreaterThan(0);
});
