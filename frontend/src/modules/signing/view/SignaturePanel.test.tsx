import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, it, expect, vi } from "vitest";
import { SignaturePanel } from "./SignaturePanel";
import { useSignature } from "../viewmodel/useSignature";

vi.mock("../viewmodel/useSignature", () => ({
  useSignature: vi.fn(),
}));

let sign: ReturnType<typeof vi.fn>;
beforeEach(() => {
  sign = vi.fn().mockResolvedValue(true);
});

it("shows a sign form when the current party has not signed yet", () => {
  vi.mocked(useSignature).mockReturnValue({
    status: {
      data: { owner: null, resident: null, fullyExecuted: false },
      error: null,
    },
    busy: false,
    error: "",
    sign,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  render(
    <SignaturePanel
      org="org"
      building="building"
      lease="lease-1"
      role="OWNER"
      defaultName="Owner Name"
    />,
  );
  expect(
    screen.getByLabelText("Type your full legal name to sign"),
  ).toHaveValue("Owner Name");
  expect(screen.getByText(/Not yet signed/)).toBeInTheDocument();
});

it("submits a typed signature", async () => {
  vi.mocked(useSignature).mockReturnValue({
    status: {
      data: { owner: null, resident: null, fullyExecuted: false },
      error: null,
    },
    busy: false,
    error: "",
    sign,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  render(
    <SignaturePanel
      org="org"
      building="building"
      lease="lease-1"
      role="OWNER"
      defaultName="Owner Name"
    />,
  );
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Sign lease" }));
  expect(sign).toHaveBeenCalledWith("OWNER", "Owner Name");
});

it("shows a confirmation once the current party has already signed", () => {
  vi.mocked(useSignature).mockReturnValue({
    status: {
      data: {
        owner: {
          signed_name: "Owner Name",
          method: "TYPED",
          signed_at: "2026-01-01",
        },
        resident: null,
        fullyExecuted: false,
      },
      error: null,
    },
    busy: false,
    error: "",
    sign,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  render(
    <SignaturePanel
      org="org"
      building="building"
      lease="lease-1"
      role="OWNER"
      defaultName="Owner Name"
    />,
  );
  expect(screen.getByText("You signed as Owner Name.")).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Sign lease" }),
  ).not.toBeInTheDocument();
});

it("hides the sign form when canSign is false", () => {
  vi.mocked(useSignature).mockReturnValue({
    status: {
      data: { owner: null, resident: null, fullyExecuted: false },
      error: null,
    },
    busy: false,
    error: "",
    sign,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  render(
    <SignaturePanel
      org="org"
      building="building"
      lease="lease-1"
      role="OWNER"
      defaultName="Owner Name"
      canSign={false}
    />,
  );
  expect(
    screen.queryByRole("button", { name: "Sign lease" }),
  ).not.toBeInTheDocument();
});
