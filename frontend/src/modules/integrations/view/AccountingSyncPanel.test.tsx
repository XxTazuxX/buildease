import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, it, expect, vi } from "vitest";
import { AccountingSyncPanel } from "./AccountingSyncPanel";
import { useAccountingSync } from "../viewmodel/useIntegrations";

vi.mock("../viewmodel/useIntegrations", () => ({
  useAccountingSync: vi.fn(),
}));

let sync: ReturnType<typeof vi.fn>;
beforeEach(() => {
  sync = vi.fn().mockResolvedValue(true);
  vi.mocked(useAccountingSync).mockReturnValue({
    history: {
      data: [
        {
          id: "sync-1",
          status: "SUCCEEDED",
          provider_reference: "stub-accounting-sync-1",
          synced_by: "owner-1",
          synced_at: "2026-01-01T00:00:00Z",
        },
      ],
      error: null,
    },
    busy: false,
    error: "",
    sync,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
});

it("lists past sync attempts", () => {
  render(<AccountingSyncPanel org="org" building="building" />);
  expect(screen.getByText(/stub-accounting-sync-1/)).toBeInTheDocument();
  expect(screen.getByText("SUCCEEDED")).toBeInTheDocument();
});

it("triggers a new sync", async () => {
  render(<AccountingSyncPanel org="org" building="building" />);
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Sync now" }));
  expect(sync).toHaveBeenCalled();
});
