import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { notify } from "./notify";
import { ToastHost } from "./ToastHost";

beforeEach(() => notify.clear());
afterEach(() => vi.useRealTimers());

it("renders nothing until a toast is raised", () => {
  render(<ToastHost />);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("shows error and success toasts as they are raised", () => {
  render(<ToastHost />);
  act(() => notify.error("Could not save"));
  act(() => notify.success("Saved"));
  expect(screen.getByText("Could not save")).toBeInTheDocument();
  expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  expect(screen.getByText("Saved")).toBeInTheDocument();
});

it("lets the user dismiss a toast", async () => {
  render(<ToastHost />);
  act(() => notify.error("Could not save"));
  await userEvent.setup().click(screen.getByRole("button", { name: /close/i }));
  expect(screen.queryByText("Could not save")).not.toBeInTheDocument();
});

it("dismisses a toast automatically, errors lingering longer than successes", () => {
  vi.useFakeTimers();
  render(<ToastHost />);
  act(() => {
    notify.success("Saved");
    notify.error("Could not save");
  });
  act(() => vi.advanceTimersByTime(4100));
  expect(screen.queryByText("Saved")).not.toBeInTheDocument();
  expect(screen.getByText("Could not save")).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(4000));
  expect(screen.queryByText("Could not save")).not.toBeInTheDocument();
});
