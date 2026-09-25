import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, it, expect, vi } from "vitest";
import { RequestDetailDialog } from "./RequestDetailDialog";
import { useRequestDetail } from "../viewmodel/useMaintenance";

vi.mock("../viewmodel/useMaintenance", () => ({
  useRequestDetail: vi.fn(),
}));

let addWorkLog: ReturnType<typeof vi.fn>;
let comment: ReturnType<typeof vi.fn>;

beforeEach(() => {
  addWorkLog = vi.fn().mockResolvedValue(true);
  comment = vi.fn().mockResolvedValue(true);
  vi.mocked(useRequestDetail).mockReturnValue({
    query: {
      data: {
        id: "req-1",
        title: "Leaking tap",
        status: "IN_PROGRESS",
        priority: "MEDIUM",
        suggested_priority: "MEDIUM",
        comments: [],
        history: [],
        work_orders: [
          {
            id: "work-1",
            assigned_account_id: null,
            vendor_id: "vendor-1",
            status: "IN_PROGRESS",
            estimated_cost: "50.00",
            actual_cost: null,
            currency: "USD",
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
        ],
        work_logs: [],
        photos: [],
      },
      isLoading: false,
      error: null,
    },
    busy: false,
    error: "",
    comment,
    addWorkLog,
    updateWorkCosts: vi.fn(),
    uploadPhoto: vi.fn(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
});

it("lets a vendor log work against their assigned work order", async () => {
  render(
    <RequestDetailDialog
      org="org"
      building="building"
      request="req-1"
      canManage={false}
      onClose={vi.fn()}
    />,
  );
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Add work note"), "Replaced washer");
  await user.click(screen.getByRole("button", { name: "Log" }));
  expect(addWorkLog).toHaveBeenCalledWith(
    "work-1",
    "Replaced washer",
    undefined,
  );
});

it("hides the internal-note checkbox from non-managers", () => {
  render(
    <RequestDetailDialog
      org="org"
      building="building"
      request="req-1"
      canManage={false}
      onClose={vi.fn()}
    />,
  );
  expect(
    screen.queryByLabelText("Internal note (not visible to the resident)"),
  ).not.toBeInTheDocument();
});

it("posts a public comment by default", async () => {
  render(
    <RequestDetailDialog
      org="org"
      building="building"
      request="req-1"
      canManage={true}
      onClose={vi.fn()}
    />,
  );
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Add a comment"), "Any update?");
  await user.click(screen.getByRole("button", { name: "Add comment" }));
  expect(comment).toHaveBeenCalledWith("Any update?", false);
});
