import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, it, expect, vi } from "vitest";
import { SettingsPanel } from "./SettingsPanel";
import { useMailSettings, useEmailTemplates } from "../viewmodel/useAdmin";

vi.mock("../viewmodel/useAdmin", () => ({
  useMailSettings: vi.fn(),
  useEmailTemplates: vi.fn(),
}));

const mailData = {
  host: "smtp.example.test",
  port: 587,
  username: "user",
  from_address: "noreply@example.test",
  starttls: true,
};
const templates = [
  {
    template_key: "VERIFICATION" as const,
    subject: "Verify",
    body: "Go to {{link}}",
  },
  {
    template_key: "PASSWORD_RESET" as const,
    subject: "Reset",
    body: "Reset at {{link}}",
  },
];

let updateMail: ReturnType<typeof vi.fn>;
let updateTemplate: ReturnType<typeof vi.fn>;

beforeEach(() => {
  updateMail = vi.fn().mockResolvedValue(true);
  updateTemplate = vi.fn().mockResolvedValue(true);
  vi.mocked(useMailSettings).mockReturnValue({
    query: { data: mailData, error: null },
    action: { error: "", busy: false },
    update: updateMail,
    sendTest: vi.fn(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  vi.mocked(useEmailTemplates).mockReturnValue({
    query: { data: templates, error: null },
    action: { error: "", busy: false },
    update: updateTemplate,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
});

it("loads existing settings but always starts the password field blank", () => {
  render(<SettingsPanel />);
  expect(screen.getByLabelText("SMTP host")).toHaveValue("smtp.example.test");
  expect(screen.getByLabelText("Password")).toHaveValue("");
});

it("saves settings with an empty password when the admin leaves it untouched", async () => {
  render(<SettingsPanel />);
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Save settings" }));
  expect(updateMail).toHaveBeenCalledWith(
    expect.objectContaining({ host: "smtp.example.test", password: "" }),
  );
});

it("blocks an out-of-range port and shows the error on the Port field", async () => {
  render(<SettingsPanel />);
  const user = userEvent.setup();
  const port = screen.getByLabelText("Port");
  await user.clear(port);
  await user.type(port, "70000");
  await user.click(screen.getByRole("button", { name: "Save settings" }));
  expect(await screen.findByText("Must be at most 65535")).toBeInTheDocument();
  expect(updateMail).not.toHaveBeenCalled();
});

it("requires a valid test recipient before sending", async () => {
  const sendTest = vi.fn();
  vi.mocked(useMailSettings).mockReturnValue({
    query: { data: mailData, error: null },
    action: { error: "", busy: false },
    update: updateMail,
    sendTest,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  render(<SettingsPanel />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Send test" }));
  expect(await screen.findByText("Required")).toBeInTheDocument();
  await user.type(screen.getByLabelText("Recipient"), "bad");
  await user.click(screen.getByRole("button", { name: "Send test" }));
  expect(await screen.findByText("Enter a valid email address")).toBeInTheDocument();
  expect(sendTest).not.toHaveBeenCalled();
});

it("requires a template subject and body", async () => {
  render(<SettingsPanel />);
  const user = userEvent.setup();
  await user.click(screen.getAllByRole("button", { name: "Edit" })[0]);
  const dialog = screen.getByRole("dialog");
  await user.clear(within(dialog).getByLabelText("Subject"));
  await user.click(within(dialog).getByRole("button", { name: "Save changes" }));
  expect(await within(dialog).findByText("Required")).toBeInTheDocument();
  expect(updateTemplate).not.toHaveBeenCalled();
});

it("previews {{link}} substitution locally without a network call", async () => {
  render(<SettingsPanel />);
  const user = userEvent.setup();
  const [firstEdit] = screen.getAllByRole("button", { name: "Edit" });
  await user.click(firstEdit);
  const dialog = screen.getByRole("dialog");
  expect(
    within(dialog).getByText(
      "Go to https://example.com/verify?token=sample-token",
    ),
  ).toBeInTheDocument();
  expect(updateTemplate).not.toHaveBeenCalled();
});
