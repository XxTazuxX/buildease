import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { useNotifications } from "../viewmodel/useNotifications";
import { NotificationBell } from "./NotificationBell";

vi.mock("../viewmodel/useNotifications", () => ({ useNotifications: vi.fn() }));

let markRead: ReturnType<typeof vi.fn>;
beforeEach(() => {
  markRead = vi.fn().mockResolvedValue(undefined);
  vi.mocked(useNotifications).mockReturnValue({
    unread: 2,
    list: {
      isLoading: false,
      isError: false,
      data: [
        {
          id: "n1",
          organization_id: "org",
          building_id: "b1",
          type: "WORK_ASSIGNED",
          title: "Maintenance work assigned",
          target_path: "/maintenance/r1",
          read_at: null,
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
    },
    markRead,
    markAllRead: vi.fn(),
  } as unknown as ReturnType<typeof useNotifications>);
});

it("shows the unread count and opens the notification's screen", async () => {
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<NotificationBell />} />
        <Route
          path="/organizations/org/operations"
          element={<div>Operations screen</div>}
        />
      </Routes>
    </MemoryRouter>,
  );
  await user.click(
    screen.getByRole("button", { name: "Notifications, 2 unread" }),
  );
  await user.click(screen.getByText("Maintenance work assigned"));
  expect(markRead).toHaveBeenCalled();
  expect(await screen.findByText("Operations screen")).toBeInTheDocument();
});
