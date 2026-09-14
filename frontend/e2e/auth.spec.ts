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
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.screenshot({ path: "../.local/mobile-login.png", fullPage: true });
  await firstLogin(page, "owner@example.test");
  await page.getByRole("button", { name: "Accept invitation" }).click();
  await expect(
    page.getByText("You’re invited to South Properties"),
  ).not.toBeVisible();
  await page.getByRole("button", { name: "Organization", exact: true }).click();
  await page.getByRole("button", { name: "South Properties", exact: true }).click();
  const currentMember = page.locator(".MuiPaper-root").filter({
    has: page.getByText("owner@example.test", { exact: true }),
  });
  await expect(currentMember.getByText("You", { exact: true })).toBeVisible();
  await expect(
    currentMember.getByRole("button", { name: "More actions" }),
  ).not.toBeVisible();
  await page.getByRole("combobox", { name: "Building", exact: true }).click();
  await expect(
    page.getByRole("option", { name: "South House · SOUTH" }),
  ).toBeVisible();
  await expect(
    page.getByRole("option", { name: "North House · NORTH" }),
  ).not.toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.screenshot({ path: "../.local/mobile-workspace.png", fullPage: true });
  await page.addStyleTag({ content: "html { font-size: 200%; }" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});
test("property manager delegates a tenant role without owner privileges", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
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
  const member = page.locator(".MuiPaper-root").filter({
    has: page.getByText("resident@example.test", { exact: true }),
  });
  await member.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("button", { name: "Building roles" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByLabel("TENANT")).toBeVisible();
  expect((await page.getByRole("dialog").boundingBox())?.width).toBe(360);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.screenshot({ path: "../.local/mobile-member.png", fullPage: true });
});

test("tablet navigation and administration use touch-friendly action sheets", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill("admin@example.test");
  await page.getByLabel("Password", { exact: true }).fill(permanent);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("link", { name: "Administration" }).click();
  await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
  const organization = page.locator(".MuiPaper-root").filter({
    has: page.getByRole("heading", { name: "East Properties", exact: true }),
  });
  await organization.getByRole("button", { name: "More actions" }).click();
  await expect(page.getByRole("link", { name: "Open workspace" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("link", { name: "Open workspace" })).not.toBeVisible();
  await expect(page.locator(".MuiDrawer-root")).not.toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.screenshot({ path: "../.local/tablet-admin.png", fullPage: true });
});
