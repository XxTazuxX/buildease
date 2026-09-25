import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, it, expect, vi } from "vitest";
import { AnnouncementsPanel } from "./AnnouncementsPanel";
import { useAnnouncements } from "../viewmodel/useAnnouncements";

vi.mock("../viewmodel/useAnnouncements", () => ({
  useAnnouncements: vi.fn(),
}));

let send: ReturnType<typeof vi.fn>;
beforeEach(() => {
  send = vi.fn().mockResolvedValue(true);
  vi.mocked(useAnnouncements).mockReturnValue({
    history: {
      data: [
        {
          id: "ann-1",
          title: "Water shutoff",
          audience: "ALL_RESIDENTS",
          sent_by: "owner-1",
          recipient_count: 3,
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
      error: null,
    },
    busy: false,
    error: "",
    send,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
});

it("lists previously sent announcements with their recipient count", () => {
  render(<AnnouncementsPanel org="org" building="building" />);
  expect(screen.getByText("Water shutoff")).toBeInTheDocument();
  expect(screen.getByText("3 recipients")).toBeInTheDocument();
});

it("sends a new announcement with the selected audience", async () => {
  render(<AnnouncementsPanel org="org" building="building" />);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Title"), "Lobby closed");
  await user.type(
    screen.getByLabelText("Message"),
    "The lobby is closed for cleaning.",
  );
  await user.click(screen.getByRole("button", { name: "Send announcement" }));
  expect(send).toHaveBeenCalledWith({
    title: "Lobby closed",
    body: "The lobby is closed for cleaning.",
    audience: "ALL_RESIDENTS",
  });
});
