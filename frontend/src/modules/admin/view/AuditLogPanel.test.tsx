import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, it, expect, vi } from "vitest";
import { AuditLogPanel } from "./AuditLogPanel";
import { usePlatformAudit } from "../viewmodel/useAdmin";

vi.mock("../viewmodel/useAdmin", () => ({
  usePlatformAudit: vi.fn(),
}));

const directEntry = {
  actor_id: "11111111-1111-1111-1111-111111111111",
  action: "ACCOUNT_CREATED",
  target_id: "22222222-2222-2222-2222-222222222222",
  organization_id: null,
  impersonated_by: null,
  created_at: "2026-01-01T00:00:00Z",
};
const impersonatedEntry = {
  ...directEntry,
  action: "BUILDING_CREATED",
  organization_id: "33333333-3333-3333-3333-333333333333",
  impersonated_by: "44444444-4444-4444-4444-444444444444",
};

beforeEach(() => {
  vi.mocked(usePlatformAudit).mockReturnValue({
    data: [directEntry, impersonatedEntry],
    error: null,
    isLoading: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
});

it("shows a via-admin annotation only for impersonated actions", () => {
  render(<AuditLogPanel />);
  expect(screen.getByText("via 44444444")).toBeInTheDocument();
  expect(screen.queryAllByText(/^via /)).toHaveLength(1);
});

it("passes the typed organization filter through to the query", async () => {
  render(<AuditLogPanel />);
  await userEvent
    .setup()
    .type(screen.getByLabelText("Organization ID"), "org-123");
  expect(usePlatformAudit).toHaveBeenLastCalledWith(0, "org-123", undefined);
});
