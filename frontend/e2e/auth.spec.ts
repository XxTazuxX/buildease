import { test, expect, type Page } from "@playwright/test";
const temporary = "Temporary password for tests!";
const permanent = "Permanent password for tests!";
async function firstLogin(page: Page, email: string) {
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(temporary);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Choose your password" }),
  ).toBeVisible();
  await page.getByLabel("Current or temporary password").fill(temporary);
  await page.getByLabel("New password", { exact: true }).fill(permanent);
  await page.getByLabel("Confirm password").fill(permanent);
  await page
    .getByRole("button", { name: "Change password", exact: true })
    .click();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(permanent);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sign out", exact: true }),
  ).toBeVisible();
}
test("administrator signs in, creates an organization and manages its building", async ({
  page,
}) => {
  await firstLogin(page, "admin@example.test");
  await page.getByRole("link", { name: "Administration" }).click();
  await page
    .getByRole("button", { name: "Create organization", exact: true })
    .click();
  await page.getByLabel("Organization name").fill("East Properties");
  await page.getByLabel("Owner email").fill("east-owner@example.test");
  await page.getByLabel("Owner name").fill("East Owner");
  await page
    .getByLabel("Temporary password (new accounts only)")
    .fill(temporary);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  const row = page
    .locator(".MuiPaper-root")
    .filter({
      has: page.getByRole("heading", { name: "East Properties", exact: true }),
    });
  await row.getByRole("link", { name: "Open workspace" }).click();
  await page.getByRole("button", { name: "Add building", exact: true }).click();
  await page.getByLabel("Building name").fill("East House");
  await page.getByLabel("Building code").fill("EAST");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add building", exact: true })
    .click();
  await page.getByRole("combobox", { name: "Building", exact: true }).click();
  await expect(
    page.getByRole("option", { name: "East House · EAST" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Sign out", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.length + sessionStorage.length),
  ).toBe(0);
  await expect(
    page.getByRole("heading", { name: "Buildings & people" }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).not.toBeVisible();
  await page.screenshot({ path: "../.local/workspace.png", fullPage: true });
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome back." }),
  ).toBeVisible();
});
test("owner accepts an invitation and switches isolated organizations", async ({
  page,
}) => {
  await firstLogin(page, "owner@example.test");
  await page.getByRole("button", { name: "Accept invitation" }).click();
  await expect(
    page.getByText("You’re invited to South Properties"),
  ).not.toBeVisible();
  await page
    .getByRole("combobox", { name: "Organization", exact: true })
    .click();
  await page
    .getByRole("option", { name: "South Properties", exact: true })
    .click();
  await page.getByRole("combobox", { name: "Building", exact: true }).click();
  await expect(
    page.getByRole("option", { name: "South House · SOUTH" }),
  ).toBeVisible();
  await expect(
    page.getByRole("option", { name: "North House · NORTH" }),
  ).not.toBeVisible();
});
test("property manager delegates a tenant role without owner privileges", async ({
  page,
}) => {
  await firstLogin(page, "manager@example.test");
  await expect(
    page.getByRole("link", { name: "Administration" }),
  ).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add building", exact: true }),
  ).not.toBeVisible();
  await page.getByRole("combobox", { name: "Building", exact: true }).click();
  await page.getByRole("option", { name: "North House · NORTH" }).click();
  await page.getByRole("button", { name: "Add member", exact: true }).click();
  await expect(page.getByLabel("Organization owner")).not.toBeVisible();
  await expect(page.getByLabel("PROPERTY MANAGER")).not.toBeVisible();
  await page.getByLabel("Member name").fill("New Resident");
  await page.getByLabel("Member email").fill("resident@example.test");
  await page
    .getByLabel("Temporary password (new accounts only)")
    .fill(temporary);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add member", exact: true })
    .click();
  await expect(page.getByText("resident@example.test")).toBeVisible();
});
