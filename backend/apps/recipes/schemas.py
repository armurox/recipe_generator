import uuid
from datetime import datetime

from ninja import Field, Schema


class RecipeSummaryOut(Schema):
    id: uuid.UUID | None = Field(default=None, description="Internal DB ID (null if not yet cached)")
    external_id: str
    source: str = "spoonacular"
    title: str
    image_url: str | None = None
    used_ingredient_count: int = 0
    missed_ingredient_count: int = 0
    used_ingredients: list[str] = Field(default_factory=list)
    missed_ingredients: list[str] = Field(default_factory=list)
    is_saved: bool = False


class RecipeDetailOut(Schema):
    id: uuid.UUID
    external_id: str | None = None
    source: str
    title: str
    description: str | None = None
    instructions: list[dict] = Field(default_factory=list)
    ingredients_json: list[dict] = Field(default_factory=list)
    prep_time_minutes: int | None = None
    cook_time_minutes: int | None = None
    servings: int | None = None
    difficulty: str | None = None
    image_url: str | None = None
    nutrition: dict | None = None
    source_url: str | None = None
    is_saved: bool = False
    created_at: datetime
    updated_at: datetime


class SuggestRecipesOut(Schema):
    using_pantry_ingredients: bool = Field(
        description="True if suggestions are based on the user's pantry; False if showing popular fallback recipes"
    )
    items: list[RecipeSummaryOut]


class SearchResultsOut(Schema):
    items: list[RecipeSummaryOut]
    total_results: int


class SavedRecipeOut(Schema):
    id: uuid.UUID
    recipe: RecipeDetailOut
    notes: str | None = None
    created_at: datetime


class CookingLogOut(Schema):
    id: uuid.UUID
    recipe_id: uuid.UUID
    recipe_title: str
    recipe_image_url: str | None = None
    cooked_at: datetime
    rating: int | None = None
    notes: str | None = None


class CookingLogIn(Schema):
    rating: int | None = Field(default=None, ge=1, le=5, description="Rating from 1-5")
    notes: str | None = None


class SaveRecipeNotesIn(Schema):
    notes: str | None = None
