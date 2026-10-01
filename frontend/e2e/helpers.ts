import { expect, type Page } from "@playwright/test";

export const temporary = "Temporary password for tests!";
export const permanent = "Permanent password for tests!";

/**
 * Signs in with whichever password the fixture account currently has. First sign-in replaces the
 * temporary password, so specs work in any order and when run on their own.
 */
export async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(permanent);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const signOut = page.getByRole("button", { name: "Sign out", exact: true });
  const failed = page.getByRole("alert");
  await expect(signOut.or(failed)).toBeVisible();
  if (await signOut.isVisible()) return;

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
  await expect(signOut).toBeVisible();
}

export async function signOut(page: Page) {
  const button = page.getByRole("button", { name: "Sign out", exact: true });
  if (!(await button.isVisible())) {
    await page.getByRole("button", { name: "Open navigation" }).click();
  }
  await button.click();
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
}
