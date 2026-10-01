import { test, expect } from "@playwright/test";
import { signIn, signOut } from "./helpers";

test("a resident's repair is triaged, assigned, worked and confirmed", async ({
  page,
}) => {
  await signIn(page, "quay-tenant@example.test");
  await page.getByRole("button", { name: "Report issue" }).click();
  const report = page.getByRole("dialog");
  await report.getByRole("combobox", { name: "Category" }).click();
  await page.getByRole("option", { name: "Plumbing" }).click();
  await report.getByLabel("Short title").fill("Leaking kitchen tap");
  await report.getByLabel("What happened?").fill("Water drips constantly.");
  await report.getByRole("button", { name: "Submit request" }).click();
  await expect(page.getByText("Leaking kitchen tap")).toBeVisible();
  await signOut(page);

  await signIn(page, "quay-manager@example.test");
  await page
    .getByRole("link", { name: "Finance & maintenance", exact: true })
    .click();
  await page.getByRole("tab", { name: "Maintenance" }).click();
  const ticket = page
    .locator(".MuiPaper-outlined")
    .filter({ hasText: "Leaking kitchen tap" });
  await ticket.getByRole("button", { name: "Confirm priority" }).click();
  await ticket.getByRole("button", { name: "Assign" }).click();
  const assign = page.getByRole("dialog");
  await assign.getByRole("combobox", { name: "Assign to" }).click();
  await page.getByRole("option", { name: "Staff account" }).click();
  await assign.getByRole("combobox", { name: "Staff member" }).click();
  await page.getByRole("option", { name: /Quay Manager/ }).click();
  await assign.getByRole("button", { name: "Assign" }).click();
  await ticket.getByRole("button", { name: "Start work" }).click();
  page.once("dialog", (dialog) => void dialog.accept("Replaced the washer"));
  await ticket.getByRole("button", { name: "Resolve" }).click();
  await expect(ticket.getByText("RESOLVED")).toBeVisible();
  await signOut(page);

  await signIn(page, "quay-tenant@example.test");
  const mine = page
    .locator(".MuiPaper-root")
    .filter({ hasText: "Leaking kitchen tap" })
    .last();
  await mine.getByRole("button", { name: "Confirm resolved" }).click();
  await expect(mine.getByText("CLOSED")).toBeVisible();
});
