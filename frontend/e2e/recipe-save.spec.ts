import { expect, test } from "@playwright/test";
import { setFakeAuth } from "./helpers/auth";
import { mockApiRoutes } from "./helpers/mock-api";

test.describe("Recipe Save Flow", () => {
  test.beforeEach(async ({ page }) => {
    await setFakeAuth(page);
    await mockApiRoutes(page);
  });

  test("save recipe from list, verify in saved page", async ({ page }) => {
    // Navigate to recipes page
    await page.goto("/recipes");

    // Wait for recipe cards to render
    await expect(page.getByText("Simple Chicken Dinner")).toBeVisible();

    // Click the heart button on the first recipe card
    // Hearts are button elements with the Heart SVG
    const heartButtons = page.locator('button:has(svg.lucide-heart)');
    await heartButtons.first().click();

    // Navigate to saved recipes page
    await page.goto("/recipes/saved");

    // The saved recipe should appear
    await expect(page.getByText("Simple Chicken Dinner")).toBeVisible();
  });
});
