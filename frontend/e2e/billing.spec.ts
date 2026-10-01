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
  await expect(page.getByText("Free trial").first()).toBeVisible();
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

  // Approval invoices the first period straight away.
  await page.getByRole("tab", { name: "Invoices" }).click();
  const invoice = page.getByRole("row").filter({ hasText: "Harbor Holdings" });
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
