import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, it, expect, vi } from "vitest";
import { ScreeningDialog } from "./ScreeningDialog";
import { useScreenings } from "../viewmodel/useScreenings";

vi.mock("../viewmodel/useScreenings", () => ({
  useScreenings: vi.fn(),
}));

let request: ReturnType<typeof vi.fn>;
beforeEach(() => {
  request = vi.fn().mockResolvedValue(true);
  vi.mocked(useScreenings).mockReturnValue({
    list: {
      data: [
        {
          id: "screening-1",
          status: "PASS",
          report:
            "Sandbox screening report for Jane Prospect: no adverse records found.",
          provider_reference: "stub-screening-1",
          requested_at: "2026-01-01T00:00:00Z",
          completed_at: "2026-01-01T00:00:01Z",
        },
      ],
      error: null,
    },
    busy: false,
    error: "",
    request,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
});

it("shows past screening reports", () => {
  render(
    <ScreeningDialog
      org="org"
      building="building"
      prospect="prospect-1"
      prospectName="Jane Prospect"
      onClose={vi.fn()}
    />,
  );
  expect(screen.getByText("PASS")).toBeInTheDocument();
  expect(screen.getByText(/no adverse records found/)).toBeInTheDocument();
});

it("requests a new screening", async () => {
  render(
    <ScreeningDialog
      org="org"
      building="building"
      prospect="prospect-1"
      prospectName="Jane Prospect"
      onClose={vi.fn()}
    />,
  );
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Request screening" }));
  expect(request).toHaveBeenCalled();
});
