import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, it, expect, vi } from "vitest";
import { ApiKeysPanel } from "./ApiKeysPanel";
import { useApiKeys } from "../viewmodel/useIntegrations";

vi.mock("../viewmodel/useIntegrations", () => ({
  useApiKeys: vi.fn(),
}));

let create: ReturnType<typeof vi.fn>;
let revoke: ReturnType<typeof vi.fn>;
beforeEach(() => {
  create = vi.fn().mockResolvedValue({ id: "key-1", key: "plain-text-key" });
  revoke = vi.fn().mockResolvedValue(true);
  vi.mocked(useApiKeys).mockReturnValue({
    list: {
      data: [
        {
          id: "key-1",
          name: "Accounting sync",
          created_at: "2026-01-01T00:00:00Z",
          last_used_at: null,
          revoked_at: null,
        },
      ],
      error: null,
    },
    busy: false,
    error: "",
    create,
    revoke,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
});

it("lists active keys with a revoke action", () => {
  render(<ApiKeysPanel org="org" />);
  expect(screen.getByText("Accounting sync")).toBeInTheDocument();
  expect(screen.getByText("ACTIVE")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Revoke" })).toBeInTheDocument();
});

it("creates a key and reveals the plaintext value once", async () => {
  render(<ApiKeysPanel org="org" />);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Key name"), "New key");
  await user.click(screen.getByRole("button", { name: "Create key" }));
  expect(create).toHaveBeenCalledWith("New key");
  expect(await screen.findByText("plain-text-key")).toBeInTheDocument();
});

it("revokes a key", async () => {
  render(<ApiKeysPanel org="org" />);
  await userEvent.setup().click(screen.getByRole("button", { name: "Revoke" }));
  expect(revoke).toHaveBeenCalledWith("key-1");
});
