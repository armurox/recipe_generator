import type { Page } from "@playwright/test";

const API = "**/api/v1";

const mockUser = {
  id: "e2e-user-uuid",
  email: "e2e@example.com",
  display_name: "E2E User",
  dietary_prefs: [],
  household_size: 2,
};

const mockPantryItem = {
  id: "e2e-item-1",
  ingredient: { id: 1, name: "Eggs", category_name: "Dairy", category_icon: null },
  quantity: 12,
  unit: "pcs",
  added_date: "2026-02-20",
  expiry_date: "2026-03-01",
  source: "manual",
  status: "available",
  created_at: "2026-02-20T10:00:00Z",
  updated_at: "2026-02-20T10:00:00Z",
};

const mockScanDetail = {
  id: "e2e-scan-1",
  image_url: "https://example.com/receipt.jpg",
  store_name: "Test Market",
  scanned_at: "2026-02-20T10:00:00Z",
  status: "pending",
  items: [
    { id: 1, raw_text: "CHICKEN BREAST", ingredient_id: 1, ingredient_name: "Chicken Breast", quantity: 2, unit: "pcs", price: 9.99, is_food: true },
    { id: 2, raw_text: "MILK 2%", ingredient_id: 2, ingredient_name: "Milk", quantity: 1, unit: "L", price: 3.49, is_food: true },
    { id: 3, raw_text: "TAX", ingredient_id: null, ingredient_name: null, quantity: null, unit: null, price: 1.75, is_food: false },
  ],
};

const mockRecipe = {
  id: "e2e-recipe-1",
  external_id: "ext-e2e-1",
  source: "spoonacular",
  title: "Simple Chicken Dinner",
  image_url: null,
  used_ingredient_count: 1,
  missed_ingredient_count: 2,
  used_ingredients: ["Chicken"],
  missed_ingredients: ["Salt", "Pepper"],
  is_saved: false,
};

export async function mockApiRoutes(page: Page) {
  let pantryItems = [mockPantryItem];
  let savedRecipeIds: string[] = [];

  // Use a single catch-all route for the API
  await page.route(`${API}/**`, (route) => {
    const url = route.request().url();
    const method = route.request().method();
    // Strip origin + base to get the path + query
    const pathWithQuery = url.replace(/.*\/api\/v1/, "");
    const [path] = pathWithQuery.split("?");

    // ── Users ──
    if (path === "/me") {
      if (method === "PATCH") {
        return route.fulfill({ json: { ...mockUser, ...JSON.parse(route.request().postData() ?? "{}") } });
      }
      return route.fulfill({ json: mockUser });
    }

    // ── Pantry ──
    if (path === "/pantry/summary") {
      return route.fulfill({
        json: {
          total_items: pantryItems.length,
          total_available: pantryItems.length,
          total_expired: 0,
          total_expiring_soon: 0,
          categories: [],
        },
      });
    }

    if (path.startsWith("/pantry/expiring")) {
      return route.fulfill({ json: [] });
    }

    if (path === "/pantry/bulk-delete") {
      return route.fulfill({ json: { deleted_count: 1 } });
    }

    if (path.match(/^\/pantry\/[^/]+\/use$/)) {
      return route.fulfill({ json: mockPantryItem });
    }

    // Single pantry item: /pantry/:id
    if (path.match(/^\/pantry\/[^/]+$/) && path !== "/pantry/summary" && path !== "/pantry/bulk-delete") {
      const id = path.replace("/pantry/", "");
      if (method === "DELETE") {
        pantryItems = pantryItems.filter((i) => i.id !== id);
        return route.fulfill({ status: 204 });
      }
      if (method === "PATCH") {
        const body = JSON.parse(route.request().postData() ?? "{}");
        pantryItems = pantryItems.map((i) => (i.id === id ? { ...i, ...body } : i));
        return route.fulfill({ json: pantryItems.find((i) => i.id === id) ?? mockPantryItem });
      }
      return route.fulfill({ json: mockPantryItem });
    }

    // Pantry list (GET) or create (POST /pantry/)
    if (path === "/pantry" || path === "/pantry/") {
      if (method === "POST") {
        const body = JSON.parse(route.request().postData() ?? "{}");
        const newItem = {
          ...mockPantryItem,
          id: `e2e-item-${Date.now()}`,
          ingredient: { ...mockPantryItem.ingredient, name: body.ingredient_name },
          quantity: body.quantity,
          unit: body.unit,
        };
        pantryItems.push(newItem);
        return route.fulfill({ status: 201, json: { item: newItem, created: true } });
      }
      return route.fulfill({ json: { items: pantryItems, count: pantryItems.length } });
    }

    // ── Receipts ──
    if (path.match(/^\/receipts\/[^/]+\/confirm$/)) {
      return route.fulfill({
        json: { pantry_items_created: 2, pantry_items_updated: 0, items: [mockPantryItem] },
      });
    }

    // Single scan: /receipts/:id
    if (path.match(/^\/receipts\/[^/]+$/) && path !== "/receipts/scan") {
      if (method === "DELETE") {
        return route.fulfill({ status: 204 });
      }
      return route.fulfill({ json: mockScanDetail });
    }

    // Receipt list
    if (path === "/receipts" || path === "/receipts/") {
      return route.fulfill({ json: { items: [], count: 0 } });
    }

    // ── Recipes ──
    if (path.startsWith("/recipes/suggest")) {
      const items = [
        mockRecipe,
        { ...mockRecipe, id: "e2e-recipe-2", external_id: "ext-e2e-2", title: "Pasta Bake" },
      ].map((r) => ({ ...r, is_saved: savedRecipeIds.includes(r.id) }));
      return route.fulfill({
        json: { using_pantry_ingredients: true, items, total_results: items.length },
      });
    }

    if (path.startsWith("/recipes/search")) {
      return route.fulfill({ json: { items: [mockRecipe], total_results: 1 } });
    }

    if (path.startsWith("/recipes/saved")) {
      const items = savedRecipeIds.map((id) => ({
        id: `saved-${id}`,
        recipe: {
          id,
          external_id: `ext-${id}`,
          source: "spoonacular",
          title: id === "e2e-recipe-1" ? "Simple Chicken Dinner" : "Pasta Bake",
          description: null, instructions: [], ingredients_json: [],
          prep_time_minutes: null, cook_time_minutes: null, servings: null,
          difficulty: null, image_url: null, nutrition: null, source_url: null,
          is_saved: true, created_at: "2026-02-21T10:00:00Z", updated_at: "2026-02-21T10:00:00Z",
        },
        notes: null,
        created_at: "2026-02-21T10:00:00Z",
      }));
      return route.fulfill({ json: { items, count: items.length } });
    }

    if (path.startsWith("/recipes/history")) {
      return route.fulfill({ json: { items: [], count: 0 } });
    }

    // Save/unsave: /recipes/:id/save
    if (path.match(/^\/recipes\/[^/]+\/save$/)) {
      const id = path.split("/recipes/")[1].split("/save")[0];
      if (method === "DELETE") {
        savedRecipeIds = savedRecipeIds.filter((r) => r !== id);
        return route.fulfill({ status: 204 });
      }
      savedRecipeIds.push(id);
      return route.fulfill({
        status: 201,
        json: { id: `saved-${id}`, recipe: { id, title: "Simple Chicken Dinner", is_saved: true }, notes: null, created_at: "2026-02-21T10:00:00Z" },
      });
    }

    // Cooked: /recipes/:id/cooked
    if (path.match(/^\/recipes\/[^/]+\/cooked$/)) {
      return route.fulfill({ status: 201, json: {} });
    }

    // Single recipe detail: /recipes/:id
    if (path.match(/^\/recipes\/[^/]+$/)) {
      return route.fulfill({
        json: {
          id: "e2e-recipe-1", external_id: "ext-e2e-1", source: "spoonacular",
          title: "Simple Chicken Dinner", description: "<b>A tasty dish</b>",
          instructions: [{ step: 1, text: "Cook chicken" }],
          ingredients_json: [{ name: "Chicken", amount: 2, unit: "pcs" }],
          prep_time_minutes: 10, cook_time_minutes: 30, servings: 4, difficulty: null,
          image_url: null, nutrition: null, source_url: null,
          is_saved: savedRecipeIds.includes("e2e-recipe-1"),
          created_at: "2026-02-20T10:00:00Z", updated_at: "2026-02-20T10:00:00Z",
        },
      });
    }

    // Fallback — let unmatched requests through
    return route.continue();
  });
}
