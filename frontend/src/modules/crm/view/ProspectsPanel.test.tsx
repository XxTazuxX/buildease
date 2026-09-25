import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, it, expect, vi } from "vitest";
import { ProspectsPanel } from "./ProspectsPanel";
import { useProspects, useProspectSpaces } from "../viewmodel/useProspects";

vi.mock("../viewmodel/useProspects", () => ({
  useProspects: vi.fn(),
  useProspectSpaces: vi.fn(),
}));
vi.mock("@/modules/screening", () => ({
  ScreeningDialog: ({ prospectName }: { prospectName: string }) => (
    <div role="dialog">Screening for {prospectName}</div>
  ),
}));

let updateStatus: ReturnType<typeof vi.fn>;
let linkLease: ReturnType<typeof vi.fn>;

beforeEach(() => {
  updateStatus = vi.fn().mockResolvedValue(true);
  linkLease = vi.fn().mockResolvedValue(true);
  vi.mocked(useProspects).mockReturnValue({
    list: {
      data: [
        {
          id: "prospect-1",
          space_id: "space-1",
          listing_id: null,
          lease_id: null,
          name: "Jane Prospect",
          email: "jane@example.test",
          phone: null,
          status: "APPROVED",
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
      error: null,
    },
    busy: false,
    error: "",
    create: vi.fn(),
    updateStatus,
    linkLease,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  vi.mocked(useProspectSpaces).mockReturnValue({
    data: [{ id: "space-1", name: "Flat 1", code: "F1", status: "VACANT" }],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
});

it("lists prospects with their space and status", () => {
  render(<ProspectsPanel org="org" building="building" />);
  expect(screen.getByText("Jane Prospect")).toBeInTheDocument();
  expect(screen.getByText(/Flat 1/)).toBeInTheDocument();
  expect(screen.getByText("APPROVED")).toBeInTheDocument();
});

it("moves a prospect to a new status", async () => {
  render(<ProspectsPanel org="org" building="building" />);
  const user = userEvent.setup();
  await user.click(screen.getByLabelText("Move to"));
  await user.click(await screen.findByRole("option", { name: "REJECTED" }));
  expect(updateStatus).toHaveBeenCalledWith("prospect-1", "REJECTED");
});

it("links an approved prospect to a lease", async () => {
  render(<ProspectsPanel org="org" building="building" />);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Lease ID"), "lease-1");
  await user.click(screen.getByRole("button", { name: "Link lease" }));
  expect(linkLease).toHaveBeenCalledWith("prospect-1", "lease-1");
});

it("opens the screening dialog for a prospect", async () => {
  render(<ProspectsPanel org="org" building="building" />);
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Screening" }));
  expect(screen.getByText("Screening for Jane Prospect")).toBeInTheDocument();
});
