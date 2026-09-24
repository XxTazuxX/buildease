import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, it, expect, vi } from "vitest";
import { PlatformPage } from "./PlatformPage";
import {
  usePlatform,
  useAction,
  useAdminCommands,
} from "../viewmodel/useAdmin";
import { useAuth } from "@/modules/auth/viewmodel/AuthProvider";

vi.mock("../viewmodel/useAdmin", () => ({
  usePlatform: vi.fn(),
  useAction: vi.fn(),
  useAdminCommands: vi.fn(),
}));
vi.mock("@/modules/auth/viewmodel/AuthProvider", () => ({
  useAuth: vi.fn(),
}));
vi.mock("./SettingsPanel", () => ({
  SettingsPanel: () => <div>settings panel</div>,
}));
vi.mock("./AuditLogPanel", () => ({
  AuditLogPanel: () => <div>audit log panel</div>,
}));

const me = {
  id: "me",
  email: "me@example.test",
  display_name: "Me",
  name: "Me",
  active: true,
  platform_admin: false,
  must_change_password: false,
};
const other = {
  id: "other",
  email: "other@example.test",
  display_name: "Other Admin",
  name: "Other Admin",
  active: true,
  platform_admin: false,
  must_change_password: false,
};

beforeEach(() => {
  vi.mocked(usePlatform).mockReturnValue({
    data: [me, other],
    error: null,
    isLoading: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  vi.mocked(useAction).mockReturnValue({
    run: vi.fn(async (fn: () => Promise<unknown>) => {
      await fn();
      return true;
    }),
    error: "",
    busy: false,
  });
  vi.mocked(useAdminCommands).mockReturnValue({
    impersonate: vi.fn().mockResolvedValue(undefined),
    accountStatus: vi.fn(),
    organizationStatus: vi.fn(),
    reset: vi.fn(),
    createOrg: vi.fn(),
    createAccount: vi.fn(),
    createBuilding: vi.fn(),
    invite: vi.fn(),
    membership: vi.fn(),
    updateMember: vi.fn(),
    accept: vi.fn(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  vi.mocked(useAuth).mockReturnValue({
    profile: me,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
});

function renderPage() {
  return render(<PlatformPage />, { wrapper: MemoryRouter });
}

it("shows Login as for other accounts but not for the signed-in admin's own row", async () => {
  renderPage();
  const user = userEvent.setup();
  await user.click(screen.getByRole("tab", { name: "Accounts" }));

  const meRow = screen
    .getByText("Me")
    .closest("div[class*=MuiPaper]") as HTMLElement;
  const otherRow = screen
    .getByText("Other Admin")
    .closest("div[class*=MuiPaper]") as HTMLElement;
  expect(
    within(meRow).queryByRole("button", { name: "Login as" }),
  ).not.toBeInTheDocument();
  expect(
    within(otherRow).getByRole("button", { name: "Login as" }),
  ).toBeInTheDocument();
});

it("calls commands.impersonate when Login as is clicked", async () => {
  const commands = useAdminCommands();
  renderPage();
  const user = userEvent.setup();
  await user.click(screen.getByRole("tab", { name: "Accounts" }));
  await user.click(screen.getAllByRole("button", { name: "Login as" })[0]);
  expect(commands.impersonate).toHaveBeenCalledWith("other");
});

it("renders the Settings panel on the Settings tab", async () => {
  renderPage();
  const user = userEvent.setup();
  await user.click(screen.getByRole("tab", { name: "Settings" }));
  expect(screen.getByText("settings panel")).toBeInTheDocument();
});

it("renders the Audit log panel on the Audit tab", async () => {
  renderPage();
  const user = userEvent.setup();
  await user.click(screen.getByRole("tab", { name: "Audit log" }));
  expect(screen.getByText("audit log panel")).toBeInTheDocument();
});
