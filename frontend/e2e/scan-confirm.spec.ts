import { expect, test } from "@playwright/test";
import { setFakeAuth } from "./helpers/auth";
import { mockApiRoutes } from "./helpers/mock-api";

test.describe("Scan Review & Confirm", () => {
  test.beforeEach(async ({ page }) => {
    await setFakeAuth(page);
    await mockApiRoutes(page);
  });

  test("review items, edit name, confirm, redirect to pantry", async ({ page }) => {
    // Navigate to scan review page
    await page.goto("/scan/e2e-scan-1");

    // Wait for items to render
    await expect(page.getByText("Test Market")).toBeVisible();
    await expect(page.getByText("2 items found")).toBeVisible();

    // Verify extracted items appear
    const chickenInput = page.locator('input[name="items.0.ingredient_name"]');
    await expect(chickenInput).toHaveValue("Chicken Breast");

    const milkInput = page.locator('input[name="items.1.ingredient_name"]');
    await expect(milkInput).toHaveValue("Milk");

    // Edit the first ingredient name
    await chickenInput.clear();
    await chickenInput.fill("Chicken Thigh");
    await expect(chickenInput).toHaveValue("Chicken Thigh");

    // Click Confirm
    await page.getByRole("button", { name: "Confirm & Add to Pantry" }).click();

    // Should redirect to pantry and show success toast
    await expect(page).toHaveURL("/pantry");
    await expect(page.getByText("2 items added to pantry")).toBeVisible();
  });
});
