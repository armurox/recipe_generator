from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class RecipeSummary:
    external_id: str
    source: str
    title: str
    image_url: str | None = None
    used_ingredient_count: int = 0
    missed_ingredient_count: int = 0
    used_ingredients: list[str] = field(default_factory=list)
    missed_ingredients: list[str] = field(default_factory=list)


@dataclass
class RecipeDetail:
    external_id: str
    source: str
    title: str
    description: str | None = None
    instructions: list[dict] = field(default_factory=list)
    ingredients_json: list[dict] = field(default_factory=list)
    prep_time_minutes: int | None = None
    cook_time_minutes: int | None = None
    servings: int | None = None
    difficulty: str | None = None
    image_url: str | None = None
    nutrition: dict | None = None
    source_url: str | None = None
    diets: list[str] = field(default_factory=list)


class RecipeProviderError(Exception):
    """Raised when an external recipe API call fails."""


class RecipeProvider(ABC):
    @abstractmethod
    async def find_by_ingredients(
        self,
        ingredients: list[str],
        count: int = 10,
        dietary: list[str] | None = None,
        offset: int = 0,
    ) -> tuple[list[RecipeSummary], int | None]:
        """Find recipes that use the given ingredients.

        Returns (results, total_results). total_results is None when the
        provider cannot determine the total (e.g. findByIngredients endpoint).
        """

    @abstractmethod
    async def get_recipe_detail(self, external_id: str) -> RecipeDetail:
        """Get full recipe details by external (Spoonacular) ID."""

    @abstractmethod
    async def get_popular(
        self,
        count: int = 10,
        dietary: list[str] | None = None,
        offset: int = 0,
    ) -> tuple[list[RecipeSummary], int]:
        """Get popular/trending recipes (no ingredient input required).

        Returns (results, total_results).
        """

    @abstractmethod
    async def search(
        self,
        query: str,
        dietary: list[str] | None = None,
        count: int = 20,
        offset: int = 0,
        max_ready_time: int | None = None,
    ) -> tuple[list[RecipeSummary], int]:
        """Search recipes by keyword. Returns (results, total_count)."""
