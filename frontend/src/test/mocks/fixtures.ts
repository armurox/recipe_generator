import type {
  CookingLog,
  PaginatedResponse,
  PantryItem,
  PantryItemCreateOutput,
  PantrySummary,
  RecipeDetail,
  RecipeSummary,
  SavedRecipe,
  SearchResults,
  SuggestRecipesResponse,
  User,
} from "@/types/api";

export const mockUser: User = {
  id: "user-uuid-1",
  email: "test@example.com",
  display_name: "Test User",
  dietary_prefs: ["vegetarian"],
  household_size: 2,
};

export const mockPantryItem: PantryItem = {
  id: "pantry-item-1",
  ingredient: {
    id: 1,
    name: "Chicken Breast",
    category_name: "Meat",
    category_icon: null,
  },
  quantity: 500,
  unit: "g",
  added_date: "2026-02-20",
  expiry_date: "2026-02-28",
  source: "manual",
  status: "available",
  created_at: "2026-02-20T10:00:00Z",
  updated_at: "2026-02-20T10:00:00Z",
};

export const mockPantryItem2: PantryItem = {
  id: "pantry-item-2",
  ingredient: {
    id: 2,
    name: "Milk",
    category_name: "Dairy",
    category_icon: null,
  },
  quantity: 1,
  unit: "L",
  added_date: "2026-02-20",
  expiry_date: "2026-02-25",
  source: "receipt",
  status: "available",
  created_at: "2026-02-20T10:00:00Z",
  updated_at: "2026-02-20T10:00:00Z",
};

export const mockPantryItems: PaginatedResponse<PantryItem> = {
  items: [mockPantryItem, mockPantryItem2],
  count: 2,
};

export const mockPantryItemCreateOutput: PantryItemCreateOutput = {
  item: mockPantryItem,
  created: true,
};

export const mockPantrySummary: PantrySummary = {
  total_items: 2,
  total_available: 2,
  total_expired: 0,
  total_expiring_soon: 1,
  categories: [
    {
      category_id: 1,
      category_name: "Meat",
      category_icon: null,
      available_count: 1,
      expired_count: 0,
      used_up_count: 0,
      expiring_soon_count: 0,
      total_count: 1,
    },
    {
      category_id: 2,
      category_name: "Dairy",
      category_icon: null,
      available_count: 1,
      expired_count: 0,
      used_up_count: 0,
      expiring_soon_count: 1,
      total_count: 1,
    },
  ],
};

export const mockRecipeSummary: RecipeSummary = {
  id: "recipe-1",
  external_id: "ext-123",
  source: "spoonacular",
  title: "Grilled Chicken Salad",
  image_url: "https://img.spoonacular.com/recipes/123.jpg",
  used_ingredient_count: 2,
  missed_ingredient_count: 1,
  used_ingredients: ["Chicken Breast", "Lettuce"],
  missed_ingredients: ["Olive Oil"],
  is_saved: false,
};

export const mockRecipeSummarySaved: RecipeSummary = {
  ...mockRecipeSummary,
  id: "recipe-2",
  external_id: "ext-456",
  title: "Chicken Pasta",
  is_saved: true,
};

export const mockRecipeDetail: RecipeDetail = {
  id: "recipe-1",
  external_id: "ext-123",
  source: "spoonacular",
  title: "Grilled Chicken Salad",
  description: "<b>A healthy salad</b>",
  instructions: [{ step: 1, text: "Grill the chicken" }],
  ingredients_json: [{ name: "Chicken Breast", amount: 200, unit: "g" }],
  prep_time_minutes: 10,
  cook_time_minutes: 20,
  servings: 2,
  difficulty: null,
  image_url: "https://img.spoonacular.com/recipes/123.jpg",
  nutrition: null,
  source_url: null,
  is_saved: false,
  created_at: "2026-02-20T10:00:00Z",
  updated_at: "2026-02-20T10:00:00Z",
};

export const mockSuggestResponse: SuggestRecipesResponse = {
  using_pantry_ingredients: true,
  items: [mockRecipeSummary, mockRecipeSummarySaved],
  total_results: 2,
};

export const mockSearchResults: SearchResults = {
  items: [mockRecipeSummary],
  total_results: 1,
};

export const mockSavedRecipe: SavedRecipe = {
  id: "saved-1",
  recipe: { ...mockRecipeDetail, is_saved: true },
  notes: null,
  created_at: "2026-02-21T10:00:00Z",
};

export const mockSavedRecipes: PaginatedResponse<SavedRecipe> = {
  items: [mockSavedRecipe],
  count: 1,
};

export const mockCookingLog: CookingLog = {
  id: "log-1",
  recipe_id: "recipe-1",
  recipe_title: "Grilled Chicken Salad",
  recipe_image_url: "https://img.spoonacular.com/recipes/123.jpg",
  cooked_at: "2026-02-21T18:00:00Z",
  rating: 4,
  notes: null,
};
