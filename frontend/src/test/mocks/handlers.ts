import { http, HttpResponse } from "msw";
import {
  mockCookingLog,
  mockPantryItem,
  mockPantryItemCreateOutput,
  mockPantryItems,
  mockPantrySummary,
  mockRecipeDetail,
  mockSavedRecipe,
  mockSavedRecipes,
  mockSearchResults,
  mockSuggestResponse,
  mockUser,
} from "./fixtures";

const API_URL = "http://localhost:8000/api/v1";

export const handlers = [
  // Users
  http.get(`${API_URL}/me`, () => HttpResponse.json(mockUser)),
  http.patch(`${API_URL}/me`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ ...mockUser, ...body });
  }),

  // Pantry
  http.get(`${API_URL}/pantry`, () => HttpResponse.json(mockPantryItems)),
  http.get(`${API_URL}/pantry/summary`, () => HttpResponse.json(mockPantrySummary)),
  http.get(`${API_URL}/pantry/expiring`, () => HttpResponse.json([mockPantryItems.items[1]])),
  http.post(`${API_URL}/pantry/`, () =>
    HttpResponse.json(mockPantryItemCreateOutput, { status: 201 }),
  ),
  http.patch(`${API_URL}/pantry/:id`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ ...mockPantryItem, ...body });
  }),
  http.delete(`${API_URL}/pantry/:id`, () => new HttpResponse(null, { status: 204 })),
  http.post(`${API_URL}/pantry/:id/use`, () => HttpResponse.json(mockPantryItem)),
  http.post(`${API_URL}/pantry/bulk-delete`, () => HttpResponse.json({ deleted_count: 1 })),

  // Recipes
  http.get(`${API_URL}/recipes/suggest`, () => HttpResponse.json(mockSuggestResponse)),
  http.get(`${API_URL}/recipes/search`, () => HttpResponse.json(mockSearchResults)),
  http.get(`${API_URL}/recipes/:id`, () => HttpResponse.json(mockRecipeDetail)),
  http.post(`${API_URL}/recipes/:id/save`, () =>
    HttpResponse.json(mockSavedRecipe, { status: 201 }),
  ),
  http.delete(`${API_URL}/recipes/:id/save`, () => new HttpResponse(null, { status: 204 })),
  http.get(`${API_URL}/recipes/saved`, () => HttpResponse.json(mockSavedRecipes)),
  http.get(`${API_URL}/recipes/history`, () =>
    HttpResponse.json({ items: [mockCookingLog], count: 1 }),
  ),
  http.post(`${API_URL}/recipes/:id/cooked`, () =>
    HttpResponse.json(mockCookingLog, { status: 201 }),
  ),
];
