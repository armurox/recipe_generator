// ── Shared ──

export type ErrorResponse = {
  detail: string;
};

export type PaginatedResponse<T> = {
  items: T[];
  count: number;
};

// ── Users ──

export type User = {
  id: string;
  email: string;
  display_name: string;
  dietary_prefs: string[];
  household_size: number;
};

export type UserUpdate = {
  display_name?: string | null;
  dietary_prefs?: string[] | null;
  household_size?: number | null;
};

// ── Pantry ──

export type Ingredient = {
  id: number;
  name: string;
  category_name: string | null;
  category_icon: string | null;
};

export type PantryItem = {
  id: string;
  ingredient: Ingredient;
  quantity: number | null;
  unit: string | null;
  added_date: string;
  expiry_date: string | null;
  source: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type PantryItemCreateInput = {
  ingredient_name: string;
  quantity?: number | null;
  unit?: string | null;
  expiry_date?: string | null;
  category_hint?: string | null;
};

export type PantryItemCreateOutput = {
  item: PantryItem;
  created: boolean;
};

export type PantryItemUpdateInput = {
  quantity?: number | null;
  unit?: string | null;
  expiry_date?: string | null;
  status?: string | null;
};

export type PantryItemUseInput = {
  quantity?: number | null;
};

export type CategorySummary = {
  category_id: number | null;
  category_name: string;
  category_icon: string | null;
  available_count: number;
  expired_count: number;
  used_up_count: number;
  expiring_soon_count: number;
  total_count: number;
};

export type PantrySummary = {
  total_items: number;
  total_available: number;
  total_expired: number;
  total_expiring_soon: number;
  categories: CategorySummary[];
};

// ── Receipts ──

export type ReceiptItem = {
  id: number;
  raw_text: string;
  ingredient_id: number | null;
  ingredient_name: string | null;
  quantity: number | null;
  unit: string | null;
  price: number | null;
  is_food: boolean;
};

export type ReceiptScan = {
  id: string;
  image_url: string;
  store_name: string | null;
  scanned_at: string;
  status: string;
  item_count: number;
};

export type ReceiptScanDetail = {
  id: string;
  image_url: string;
  store_name: string | null;
  scanned_at: string;
  status: string;
  items: ReceiptItem[];
};

export type ScanReceiptInput = {
  image_url: string;
};

export type ConfirmItem = {
  receipt_item_id: number;
  ingredient_name?: string | null;
  quantity?: number | null;
  unit?: string | null;
  expiry_date?: string | null;
};

export type ConfirmReceiptInput = {
  items: ConfirmItem[];
};

export type ConfirmReceiptOutput = {
  pantry_items_created: number;
  pantry_items_updated: number;
  items: PantryItem[];
};

// ── Recipes ──

export type RecipeSummary = {
  id: string | null;
  external_id: string;
  source: string;
  title: string;
  image_url: string | null;
  used_ingredient_count: number;
  missed_ingredient_count: number;
  used_ingredients: string[];
  missed_ingredients: string[];
  is_saved: boolean;
};

export type RecipeDetail = {
  id: string;
  external_id: string | null;
  source: string;
  title: string;
  description: string | null;
  instructions: Record<string, unknown>[];
  ingredients_json: Record<string, unknown>[];
  prep_time_minutes: number | null;
  cook_time_minutes: number | null;
  servings: number | null;
  difficulty: string | null;
  image_url: string | null;
  nutrition: Record<string, unknown> | null;
  source_url: string | null;
  is_saved: boolean;
  created_at: string;
  updated_at: string;
};

export type SearchResults = {
  items: RecipeSummary[];
  total_results: number;
};

export type SavedRecipe = {
  id: string;
  recipe: RecipeDetail;
  notes: string | null;
  created_at: string;
};

export type SaveRecipeNotes = {
  notes: string | null;
};

export type CookingLog = {
  id: string;
  recipe_id: string;
  recipe_title: string;
  recipe_image_url: string | null;
  cooked_at: string;
  rating: number | null;
  notes: string | null;
};

export type CookingLogInput = {
  rating?: number | null;
  notes?: string | null;
};
