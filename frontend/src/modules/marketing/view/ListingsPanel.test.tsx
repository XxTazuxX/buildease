import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, it, expect, vi } from "vitest";
import { ListingsPanel } from "./ListingsPanel";
import {
  useListingDetail,
  useListingSpaces,
  useListings,
} from "../viewmodel/useListings";

vi.mock("../viewmodel/useListings", () => ({
  useListings: vi.fn(),
  useListingSpaces: vi.fn(),
  useListingDetail: vi.fn(),
}));

let publish: ReturnType<typeof vi.fn>;
beforeEach(() => {
  publish = vi.fn().mockResolvedValue(true);
  vi.mocked(useListings).mockReturnValue({
    list: {
      data: [
        {
          id: "listing-1",
          space_id: "space-1",
          headline: "Bright 1BR",
          rent_amount: "1200.00",
          currency: "USD",
          status: "DRAFT",
          published_at: null,
        },
      ],
      error: null,
    },
    busy: false,
    error: "",
    create: vi.fn(),
    publish,
    unpublish: vi.fn(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  vi.mocked(useListingSpaces).mockReturnValue({
    data: [
      {
        id: "space-1",
        name: "Flat 1",
        code: "F1",
        rentable: true,
        status: "VACANT",
      },
    ],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  vi.mocked(useListingDetail).mockReturnValue({
    data: undefined,
    isLoading: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
});

it("lists draft listings with their space and status", () => {
  render(<ListingsPanel org="org" building="building" />);
  expect(screen.getByText("Bright 1BR")).toBeInTheDocument();
  expect(screen.getByText(/Flat 1/)).toBeInTheDocument();
  expect(screen.getByText("DRAFT")).toBeInTheDocument();
});

it("blocks a listing without a space, headline, description and rent", async () => {
  const create = vi.fn().mockResolvedValue(true);
  vi.mocked(useListings).mockReturnValue({
    ...vi.mocked(useListings)("org", "building"),
    create,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  render(<ListingsPanel org="org" building="building" />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "New listing" }));
  const dialog = await screen.findByRole("dialog");
  await user.click(within(dialog).getByRole("button", { name: "Create listing" }));
  expect(await within(dialog).findByText("Select a space")).toBeInTheDocument();
  expect(within(dialog).getAllByText("Required")).toHaveLength(3);
  expect(create).not.toHaveBeenCalled();
});

it("rejects a zero rent and passes the numeric rent when valid", async () => {
  const create = vi.fn().mockResolvedValue(true);
  vi.mocked(useListings).mockReturnValue({
    ...vi.mocked(useListings)("org", "building"),
    create,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  render(<ListingsPanel org="org" building="building" />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "New listing" }));
  const dialog = await screen.findByRole("dialog");
  await user.click(within(dialog).getByLabelText("Space"));
  await user.click(await screen.findByRole("option", { name: "Flat 1 · F1" }));
  await user.type(within(dialog).getByLabelText("Headline"), "Bright 1BR");
  await user.type(within(dialog).getByLabelText("Description"), "Sunny flat");
  await user.type(within(dialog).getByLabelText("Monthly rent"), "0");
  await user.click(within(dialog).getByRole("button", { name: "Create listing" }));
  expect(await within(dialog).findByText("Must be at least 0.01")).toBeInTheDocument();
  expect(create).not.toHaveBeenCalled();
  const rent = within(dialog).getByLabelText("Monthly rent");
  await user.clear(rent);
  await user.type(rent, "1200.50");
  await user.click(within(dialog).getByRole("button", { name: "Create listing" }));
  await vi.waitFor(() => expect(create).toHaveBeenCalledTimes(1));
  expect(create).toHaveBeenCalledWith({
    spaceId: "space-1",
    headline: "Bright 1BR",
    description: "Sunny flat",
    rentAmount: 1200.5,
  });
});

it("requires at least one channel before publishing", async () => {
  render(<ListingsPanel org="org" building="building" />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Publish" }));
  const dialog = screen.getByRole("dialog");
  await user.click(within(dialog).getByRole("button", { name: "Publish" }));
  expect(
    await within(dialog).findByText("Select at least one channel"),
  ).toBeInTheDocument();
  expect(publish).not.toHaveBeenCalled();
});

it("publishes a listing to the selected channels", async () => {
  render(<ListingsPanel org="org" building="building" />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Publish" }));
  const dialog = screen.getByRole("dialog");
  await user.click(within(dialog).getByLabelText("ZILLOW"));
  await user.click(within(dialog).getByRole("button", { name: "Publish" }));
  expect(publish).toHaveBeenCalledWith("listing-1", ["ZILLOW"]);
});
