import { test, expect } from "@playwright/test";
import { signIn, signOut } from "./helpers";

test("owner requests a plan, the operator approves and invoices, and the owner sees the invoice", async ({
  page,
}) => {
  await signIn(page, "billing-owner@example.test");
  await page.getByRole("link", { name: "Plan & billing" }).click();
  await expect(
    page.getByRole("heading", { name: "Plan & billing" }),
  ).toBeVisible();
  await expect(page.getByText("Professional").first()).toBeVisible();
  await page.getByRole("button", { name: /Annual/ }).click();
  await page.getByRole("button", { name: "Request Starter" }).click();
  await expect(page.getByText(/You requested Starter/)).toBeVisible();
  await signOut(page);

  await signIn(page, "admin@example.test");
  await page.getByRole("link", { name: "Administration" }).click();
  await page.getByRole("tab", { name: "Billing" }).click();
  const row = page.getByRole("row").filter({ hasText: "Harbor Holdings" });
  await row.getByRole("button", { name: "Approve" }).click();
  await expect(row.getByText("Starter")).toBeVisible();

  await page.getByRole("tab", { name: "Invoices" }).click();
  await page.getByRole("button", { name: "New invoice" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox", { name: "Organization" }).click();
  await page.getByRole("option", { name: "Harbor Holdings" }).click();
  await dialog.getByRole("button", { name: "Create draft" }).click();
  const invoice = page.getByRole("row").filter({ hasText: "Harbor Holdings" });
  await invoice.getByRole("button", { name: "Issue" }).click();
  await expect(invoice.getByText("Issued")).toBeVisible();
  await signOut(page);

  await signIn(page, "billing-owner@example.test");
  await page.getByRole("link", { name: "Plan & billing" }).click();
  await expect(page.getByText("Starter").first()).toBeVisible();
  const ownerInvoice = page.getByRole("row").filter({ hasText: "BE-" });
  await expect(ownerInvoice.getByText("Issued")).toBeVisible();
  await ownerInvoice.getByRole("button", { name: "View" }).click();
  await expect(
    page.getByRole("heading", { name: /^Invoice BE-/ }),
  ).toBeVisible();
});
