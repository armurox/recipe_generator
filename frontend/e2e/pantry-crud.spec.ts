import { expect, test } from "@playwright/test";
import { setFakeAuth } from "./helpers/auth";
import { mockApiRoutes } from "./helpers/mock-api";

test.describe("Pantry CRUD", () => {
  test.beforeEach(async ({ page }) => {
    await setFakeAuth(page);
    await mockApiRoutes(page);
  });

  test("add item, edit, delete", async ({ page }) => {
    await page.goto("/pantry");

    // Wait for pantry to load — existing item should be visible
    await expect(page.getByText("Eggs")).toBeVisible();

    // Click the "+" add button
    const addButton = page.locator('button:has(svg.lucide-plus)');
    await addButton.click();

    // Fill add item form
    await page.getByPlaceholder("e.g. Chicken Breast").fill("Tomatoes");
    await page.getByPlaceholder("500").fill("6");
    await page.getByRole("textbox", { name: "g", exact: true }).fill("pcs");

    // Submit
    await page.getByRole("button", { name: "Add Item" }).click();

    // Toast should confirm
    await expect(page.getByText("Tomatoes added to pantry")).toBeVisible();

    // New item should appear in the list (use exact match to avoid toast collision)
    await expect(page.getByText("Tomatoes", { exact: true })).toBeVisible();

    // Click on the new item row to open edit sheet
    await page.getByText("Tomatoes", { exact: true }).click();

    // Edit quantity in the sheet
    const qtyInput = page.locator('input[placeholder="0"]').first();
    await qtyInput.clear();
    await qtyInput.fill("4");

    // Save changes
    await page.getByRole("button", { name: "Save Changes" }).click();

    // Toast confirms update
    await expect(page.getByText("Item updated")).toBeVisible();
  });
});
