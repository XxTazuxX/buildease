import { render, screen, waitFor, within } from "@testing-library/react";
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

const leaseUuid = "11111111-1111-4111-8111-111111111111";

it("links an approved prospect to a lease", async () => {
  render(<ProspectsPanel org="org" building="building" />);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Lease ID"), leaseUuid);
  await user.click(screen.getByRole("button", { name: "Link lease" }));
  await waitFor(() =>
    expect(linkLease).toHaveBeenCalledWith("prospect-1", leaseUuid),
  );
});

it("rejects a lease ID that is not a UUID", async () => {
  render(<ProspectsPanel org="org" building="building" />);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Lease ID"), "lease-1");
  await user.click(screen.getByRole("button", { name: "Link lease" }));
  expect(await screen.findByText("Enter a valid lease ID")).toBeInTheDocument();
  expect(linkLease).not.toHaveBeenCalled();
});

it("blocks a new prospect without a space or name and flags a bad email", async () => {
  const create = vi.fn().mockResolvedValue(true);
  vi.mocked(useProspects).mockReturnValue({
    ...vi.mocked(useProspects)("org", "building"),
    create,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  render(<ProspectsPanel org="org" building="building" />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "New prospect" }));
  const dialog = await screen.findByRole("dialog");
  await user.type(within(dialog).getByLabelText("Email (optional)"), "nope");
  await user.click(within(dialog).getByRole("button", { name: "Add prospect" }));
  expect(await within(dialog).findByText("Select a space")).toBeInTheDocument();
  expect(within(dialog).getByText("Required")).toBeInTheDocument();
  expect(
    within(dialog).getByText("Enter a valid email address"),
  ).toBeInTheDocument();
  expect(create).not.toHaveBeenCalled();
});

it("opens the screening dialog for a prospect", async () => {
  render(<ProspectsPanel org="org" building="building" />);
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Screening" }));
  expect(screen.getByText("Screening for Jane Prospect")).toBeInTheDocument();
});
