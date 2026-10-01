import { test, expect } from "@playwright/test";

test("visitors see the landing page and live pricing before signing up", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Run every building from one calm workspace.",
    }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Pricing", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/pricing$/);
  for (const plan of ["Starter", "Professional", "Enterprise"])
    await expect(page.getByRole("heading", { name: plan })).toBeVisible();
  await expect(page.getByText("Free trial", { exact: true })).not.toBeVisible();

  await page.getByRole("button", { name: "Start free trial" }).first().click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByLabel("Organization name")).toBeVisible();
});
