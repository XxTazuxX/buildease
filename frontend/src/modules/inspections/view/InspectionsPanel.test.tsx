import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, it, expect, vi } from "vitest";
import { InspectionsPanel } from "./InspectionsPanel";
import {
  useInspectionDetail,
  useInspectionResidents,
  useInspectionSpaces,
  useInspections,
} from "../viewmodel/useInspections";

vi.mock("../viewmodel/useInspections", () => ({
  useInspections: vi.fn(),
  useInspectionSpaces: vi.fn(),
  useInspectionResidents: vi.fn(),
  useInspectionDetail: vi.fn(),
}));

let create: ReturnType<typeof vi.fn>;
beforeEach(() => {
  create = vi.fn().mockResolvedValue(true);
  vi.mocked(useInspections).mockReturnValue({
    list: {
      data: [
        {
          id: "inspection-1",
          space_id: "space-1",
          lease_id: null,
          resident_id: null,
          type: "MOVE_IN",
          status: "DRAFT",
          scheduled_on: "2026-01-01",
          completed_at: null,
          resident_acknowledged_at: null,
        },
      ],
      error: null,
    },
    busy: false,
    error: "",
    create,
    complete: vi.fn(),
    acknowledge: vi.fn(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  vi.mocked(useInspectionSpaces).mockReturnValue({
    data: [{ id: "space-1", name: "Flat 1", code: "F1" }],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  vi.mocked(useInspectionResidents).mockReturnValue({
    data: [],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  vi.mocked(useInspectionDetail).mockReturnValue({
    detail: { data: undefined, isLoading: false, refetch: vi.fn() },
    busy: false,
    error: "",
    addItem: vi.fn(),
    uploadPhoto: vi.fn(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
});

it("lists scheduled inspections with their space and status", () => {
  render(<InspectionsPanel org="org" building="building" />);
  expect(screen.getByText(/MOVE IN/)).toBeInTheDocument();
  expect(screen.getByText(/Flat 1/)).toBeInTheDocument();
  expect(screen.getByText("DRAFT")).toBeInTheDocument();
});

it("schedules a new inspection for the selected space", async () => {
  render(<InspectionsPanel org="org" building="building" />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Schedule inspection" }));
  await user.click(screen.getByLabelText("Space"));
  await user.click(await screen.findByRole("option", { name: /Flat 1/ }));
  await user.click(screen.getByRole("button", { name: "Schedule" }));
  expect(create).toHaveBeenCalled();
});
