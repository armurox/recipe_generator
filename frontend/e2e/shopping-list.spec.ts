import { expect, test } from "@playwright/test";
import { setFakeAuth } from "./helpers/auth";
import { mockApiRoutes } from "./helpers/mock-api";

test.describe("Shopping List", () => {
  test.beforeEach(async ({ page }) => {
    await setFakeAuth(page);
    await mockApiRoutes(page);
  });

  test("cart icon navigates to shopping list and back to pantry", async ({ page }) => {
    await page.goto("/pantry");

    // Wait for pantry to load
    await expect(page.getByRole("heading", { name: "Pantry" })).toBeVisible();
    await expect(page.getByText("Eggs")).toBeVisible();

    // Filter tabs should be visible on pantry view
    await expect(page.getByRole("button", { name: "All" })).toBeVisible();

    // Click the cart icon to switch to shopping list
    await page.locator("button:has(svg.lucide-shopping-cart)").click();

    // Title should change to "Shopping List"
    await expect(page.getByRole("heading", { name: "Shopping List", exact: true })).toBeVisible();

    // Filter tabs should NOT be visible on shopping list view
    await expect(page.getByRole("button", { name: "All" })).not.toBeVisible();

    // Icon should switch to Package (back to pantry)
    await expect(page.locator("button:has(svg.lucide-package)")).toBeVisible();

    // Click Package icon to go back to pantry
    await page.locator("button:has(svg.lucide-package)").click();

    // Should be back on pantry
    await expect(page.getByRole("heading", { name: "Pantry" })).toBeVisible();
    await expect(page.getByRole("button", { name: "All" })).toBeVisible();
  });

  test("add shopping item without expiry field, mark as purchased", async ({ page }) => {
    await page.goto("/pantry");
    await expect(page.getByText("Eggs")).toBeVisible();

    // Switch to shopping list view
    await page.locator("button:has(svg.lucide-shopping-cart)").click();
    await expect(page.getByRole("heading", { name: "Shopping List", exact: true })).toBeVisible();

    // Click the header "+" button (not dialog's "Add Row")
    await page.locator("header button:has(svg.lucide-plus), .flex.items-center.gap-2 button:has(svg.lucide-plus)").first().click();

    // Dialog should say "Add Shopping Items"
    await expect(page.getByText("Add Shopping Items")).toBeVisible();

    // Expiry field should NOT be visible
    await expect(page.getByText("Expiry")).not.toBeVisible();

    // Fill in the item
    await page.getByPlaceholder("e.g. Chicken Breast").fill("Butter");
    await page.locator('input[name="items.0.quantity"]').fill("1");
    await page.locator('input[name="items.0.unit"]').fill("block");

    // Submit
    await page.getByRole("button", { name: "Add 1 Item" }).click();
    await expect(page.getByText("1 item: 1 added")).toBeVisible();

    // Butter should appear in the shopping list
    await expect(page.getByText("Butter", { exact: true })).toBeVisible();

    // Mark it as purchased via the check circle button
    await page.locator("button:has(svg.lucide-circle-check-big)").click();

    // Toast should confirm purchase
    await expect(page.getByText("Marked as purchased")).toBeVisible();
  });

  test("buy all marks all shopping items as purchased", async ({ page }) => {
    await page.goto("/pantry");
    await expect(page.getByText("Eggs")).toBeVisible();

    // Switch to shopping list view
    await page.locator("button:has(svg.lucide-shopping-cart)").click();
    await expect(page.getByRole("heading", { name: "Shopping List", exact: true })).toBeVisible();

    // Add first item — use the green circle plus button in the header
    const headerAddBtn = page.locator("div.flex.items-center.gap-2 > button:has(svg.lucide-plus)");
    await headerAddBtn.click();
    await page.getByPlaceholder("e.g. Chicken Breast").fill("Milk");
    await page.getByRole("button", { name: "Add 1 Item" }).click();
    await expect(page.getByText("1 item: 1 added")).toBeVisible();

    // Add second item
    await headerAddBtn.click();
    await page.getByPlaceholder("e.g. Chicken Breast").fill("Bread");
    await page.getByRole("button", { name: "Add 1 Item" }).click();
    await expect(page.getByText("1 item: 1 added")).toBeVisible();

    // Both items should be visible
    await expect(page.getByText("Milk", { exact: true })).toBeVisible();
    await expect(page.getByText("Bread", { exact: true })).toBeVisible();

    // "Buy All" button should be visible with count
    const buyAllButton = page.getByRole("button", { name: /Buy All/ });
    await expect(buyAllButton).toBeVisible();

    // Click Buy All
    await buyAllButton.click();

    // Toast should confirm all items purchased
    await expect(page.getByText(/items? marked as purchased/)).toBeVisible();
  });

  test("shopping items do not appear in pantry all view", async ({ page }) => {
    await page.goto("/pantry");
    await expect(page.getByText("Eggs")).toBeVisible();

    // Switch to shopping list, add an item
    await page.locator("button:has(svg.lucide-shopping-cart)").click();
    await expect(page.getByRole("heading", { name: "Shopping List", exact: true })).toBeVisible();

    const headerAddBtn = page.locator("div.flex.items-center.gap-2 > button:has(svg.lucide-plus)");
    await headerAddBtn.click();
    await page.getByPlaceholder("e.g. Chicken Breast").fill("Yogurt");
    await page.getByRole("button", { name: "Add 1 Item" }).click();
    await expect(page.getByText("1 item: 1 added")).toBeVisible();
    await expect(page.getByText("Yogurt", { exact: true })).toBeVisible();

    // Go back to pantry
    await page.locator("button:has(svg.lucide-package)").click();
    await expect(page.getByRole("heading", { name: "Pantry" })).toBeVisible();

    // Yogurt (to_buy) should NOT appear in pantry "All" view
    await expect(page.getByText("Yogurt", { exact: true })).not.toBeVisible();

    // But Eggs (available) should still be there
    await expect(page.getByText("Eggs")).toBeVisible();
  });
});
