import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, it, expect, vi } from "vitest";
import { ProspectsPanel } from "./ProspectsPanel";
import {
  useProspectLeases,
  useProspects,
  useProspectSpaces,
} from "../viewmodel/useProspects";

vi.mock("../viewmodel/useProspects", () => ({
  useProspects: vi.fn(),
  useProspectSpaces: vi.fn(),
  useProspectLeases: vi.fn(),
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
  vi.mocked(useProspectLeases).mockReturnValue({
    data: [lease("lease-1", "space-1", "DRAFT")],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
});

function lease(id: string, spaceId: string, status: string) {
  return {
    id,
    space_id: spaceId,
    status,
    rent_amount: "1200.00",
    currency: "USD",
    starts_on: "2026-02-01",
  };
}

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

it("links an approved prospect to a lease picked from a list", async () => {
  render(<ProspectsPanel org="org" building="building" />);
  const user = userEvent.setup();
  await user.click(screen.getByLabelText("Lease"));
  await user.click(
    await screen.findByRole("option", { name: /DRAFT · 1200.00 USD\/month/ }),
  );
  await user.click(screen.getByRole("button", { name: "Link lease" }));
  await waitFor(() =>
    expect(linkLease).toHaveBeenCalledWith("prospect-1", "lease-1"),
  );
});

it("asks for a lease before linking", async () => {
  render(<ProspectsPanel org="org" building="building" />);
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Link lease" }));
  expect(await screen.findByText("Select a lease")).toBeInTheDocument();
  expect(linkLease).not.toHaveBeenCalled();
});

it("only offers draft or active leases for the prospect's space that are not already linked", async () => {
  vi.mocked(useProspectLeases).mockReturnValue({
    data: [
      lease("lease-ok", "space-1", "ACTIVE"),
      lease("lease-other-space", "space-2", "DRAFT"),
      lease("lease-ended", "space-1", "ENDED"),
      lease("lease-taken", "space-1", "DRAFT"),
    ],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  const base = vi.mocked(useProspects)("org", "building");
  vi.mocked(useProspects).mockReturnValue({
    ...base,
    list: {
      ...base.list,
      data: [
        ...(base.list.data ?? []),
        {
          id: "prospect-2",
          space_id: "space-1",
          listing_id: null,
          lease_id: "lease-taken",
          name: "Other Person",
          email: null,
          phone: null,
          status: "LEASED",
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  render(<ProspectsPanel org="org" building="building" />);
  await userEvent.setup().click(screen.getByLabelText("Lease"));
  expect(await screen.findAllByRole("option")).toHaveLength(1);
  expect(screen.getByRole("option", { name: /ACTIVE/ })).toBeInTheDocument();
});

it("explains when there is no lease to link and disables the button", () => {
  vi.mocked(useProspectLeases).mockReturnValue({
    data: [],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  render(<ProspectsPanel org="org" building="building" />);
  expect(
    screen.getByText(/No draft or active lease for this space yet/),
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Link lease" })).toBeDisabled();
});

it("shows an error instead of a silently empty list when leases fail to load", () => {
  vi.mocked(useProspectLeases).mockReturnValue({
    data: undefined,
    error: new Error("Unable to complete request"),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  render(<ProspectsPanel org="org" building="building" />);
  expect(screen.getByText("Unable to complete request")).toBeInTheDocument();
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
  await user.click(
    within(dialog).getByRole("button", { name: "Add prospect" }),
  );
  expect(await within(dialog).findByText("Select a space")).toBeInTheDocument();
  expect(within(dialog).getByText("Required")).toBeInTheDocument();
  expect(
    within(dialog).getByText("Enter a valid email address"),
  ).toBeInTheDocument();
  expect(create).not.toHaveBeenCalled();
});

const withVm = (overrides: Record<string, unknown>) =>
  vi.mocked(useProspects).mockReturnValue({
    ...vi.mocked(useProspects)("org", "building"),
    ...overrides,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

const spaceUuid = "33333333-3333-4333-8333-333333333333";
const useUuidSpace = () =>
  vi.mocked(useProspectSpaces).mockReturnValue({
    data: [{ id: spaceUuid, name: "Flat 1", code: "F1", status: "VACANT" }],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

const storedDetail = {
  id: "prospect-1",
  space_id: spaceUuid,
  name: "Jane Prospect",
  email: "jane@example.test",
  phone: "555-0100",
  notes: "Called twice",
};

it("opens Edit with the stored details, locks the space and saves changes", async () => {
  useUuidSpace();
  const update = vi.fn().mockResolvedValue(true);
  withVm({ loadDetail: vi.fn().mockResolvedValue(storedDetail), update });
  render(<ProspectsPanel org="org" building="building" />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Edit" }));
  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).getByText("Edit prospect")).toBeInTheDocument();
  expect(within(dialog).getByLabelText("Name")).toHaveValue("Jane Prospect");
  expect(within(dialog).getByLabelText("Email (optional)")).toHaveValue(
    "jane@example.test",
  );
  expect(within(dialog).getByLabelText("Notes (optional)")).toHaveValue(
    "Called twice",
  );
  expect(within(dialog).getByLabelText("Space")).toHaveAttribute(
    "aria-disabled",
    "true",
  );

  const phone = within(dialog).getByLabelText("Phone (optional)");
  await user.clear(phone);
  await user.type(phone, "555-0199");
  await user.click(
    within(dialog).getByRole("button", { name: "Save changes" }),
  );
  await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
  expect(update).toHaveBeenCalledWith(
    "prospect-1",
    expect.objectContaining({ name: "Jane Prospect", phone: "555-0199" }),
  );
});

it("validates an edit before saving it", async () => {
  useUuidSpace();
  const update = vi.fn().mockResolvedValue(true);
  withVm({ loadDetail: vi.fn().mockResolvedValue(storedDetail), update });
  render(<ProspectsPanel org="org" building="building" />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Edit" }));
  const dialog = await screen.findByRole("dialog");
  await user.clear(within(dialog).getByLabelText("Name"));
  const email = within(dialog).getByLabelText("Email (optional)");
  await user.clear(email);
  await user.type(email, "nope");
  await user.click(
    within(dialog).getByRole("button", { name: "Save changes" }),
  );
  expect(await within(dialog).findByText("Required")).toBeInTheDocument();
  expect(
    within(dialog).getByText("Enter a valid email address"),
  ).toBeInTheDocument();
  expect(update).not.toHaveBeenCalled();
});

it("asks for confirmation before deleting a prospect", async () => {
  const remove = vi.fn().mockResolvedValue(true);
  withVm({ remove });
  render(<ProspectsPanel org="org" building="building" />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Delete" }));
  const dialog = await screen.findByRole("dialog");
  expect(
    within(dialog).getByText(/Permanently delete .*Jane Prospect/),
  ).toBeInTheDocument();
  await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
  expect(remove).not.toHaveBeenCalled();

  await user.click(screen.getByRole("button", { name: "Delete" }));
  await user.click(
    within(await screen.findByRole("dialog")).getByRole("button", {
      name: "Delete prospect",
    }),
  );
  await waitFor(() => expect(remove).toHaveBeenCalledWith("prospect-1"));
});

it("keeps the confirmation open and shows why when the server refuses the delete", async () => {
  withVm({
    remove: vi.fn().mockResolvedValue(false),
    error: "Screening records exist for this prospect, so it cannot be deleted",
  });
  render(<ProspectsPanel org="org" building="building" />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Delete" }));
  await user.click(
    within(await screen.findByRole("dialog")).getByRole("button", {
      name: "Delete prospect",
    }),
  );
  expect(
    within(screen.getByRole("dialog")).getByText(
      /Screening records exist for this prospect/,
    ),
  ).toBeInTheDocument();
});

it("does not offer Delete for a leased prospect", () => {
  const base = vi.mocked(useProspects)("org", "building");
  withVm({
    list: {
      ...base.list,
      data: [{ ...base.list.data![0], status: "LEASED", lease_id: "lease-1" }],
    },
  });
  render(<ProspectsPanel org="org" building="building" />);
  expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Delete" }),
  ).not.toBeInTheDocument();
});

it("opens the screening dialog for a prospect", async () => {
  render(<ProspectsPanel org="org" building="building" />);
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Screening" }));
  expect(screen.getByText("Screening for Jane Prospect")).toBeInTheDocument();
});
