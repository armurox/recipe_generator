import logging

import httpx
from django.conf import settings

from apps.recipes.services.base import (
    RecipeDetail,
    RecipeProvider,
    RecipeProviderError,
    RecipeSummary,
)

logger = logging.getLogger(__name__)


class SpoonacularProvider(RecipeProvider):
    """Spoonacular API implementation of RecipeProvider.

    Auth via x-api-key header. Uses httpx client per-call (no persistent client),
    matching the ClaudeOCRProvider pattern.
    """

    def __init__(self):
        self.base_url = settings.SPOONACULAR_BASE_URL
        self.api_key = settings.SPOONACULAR_API_KEY

    def _headers(self) -> dict:
        return {"x-api-key": self.api_key}

    async def find_by_ingredients(
        self,
        ingredients: list[str],
        count: int = 10,
        dietary: list[str] | None = None,
    ) -> list[RecipeSummary]:
        """Find recipes by ingredient list.

        When dietary prefs are present, switches from findByIngredients to
        complexSearch with includeIngredients + diet, since findByIngredients
        doesn't support diet filters.
        """
        logger.info(
            "[find_by_ingredients] ingredients=%d count=%d dietary=%s",
            len(ingredients),
            count,
            dietary,
        )

        if dietary:
            return await self._find_by_ingredients_complex(ingredients, count, dietary)
        return await self._find_by_ingredients_simple(ingredients, count)

    async def _find_by_ingredients_simple(self, ingredients: list[str], count: int) -> list[RecipeSummary]:
        """Use /recipes/findByIngredients — provides used/missed ingredient data."""
        url = f"{self.base_url}/recipes/findByIngredients"
        params = {
            "ingredients": ",".join(ingredients),
            "number": count,
            "ranking": 2,  # Minimize missing ingredients
            "ignorePantry": True,
        }

        data = await self._request(url, params)
        results = []
        for item in data:
            results.append(
                RecipeSummary(
                    external_id=str(item["id"]),
                    source="spoonacular",
                    title=item["title"],
                    image_url=item.get("image"),
                    used_ingredient_count=item.get("usedIngredientCount", 0),
                    missed_ingredient_count=item.get("missedIngredientCount", 0),
                    used_ingredients=[ing["name"] for ing in item.get("usedIngredients", [])],
                    missed_ingredients=[ing["name"] for ing in item.get("missedIngredients", [])],
                )
            )
        logger.info("[find_by_ingredients_simple] returned %d results", len(results))
        return results

    async def _find_by_ingredients_complex(
        self, ingredients: list[str], count: int, dietary: list[str]
    ) -> list[RecipeSummary]:
        """Use /recipes/complexSearch with includeIngredients + diet.

        Decision: findByIngredients doesn't support diet filters. When dietary
        prefs are present, we use complexSearch instead, which loses the
        used/missed ingredient breakdown but respects dietary restrictions.
        """
        url = f"{self.base_url}/recipes/complexSearch"
        params = {
            "includeIngredients": ",".join(ingredients),
            "diet": ",".join(dietary),
            "number": count,
            "sort": "min-missing-ingredients",
            "fillIngredients": True,
        }

        data = await self._request(url, params)
        results = []
        for item in data.get("results", []):
            results.append(self._parse_complex_result(item))
        logger.info("[find_by_ingredients_complex] returned %d results", len(results))
        return results

    async def get_recipe_detail(self, external_id: str) -> RecipeDetail:
        """Fetch full recipe details from /recipes/{id}/information."""
        logger.info("[get_recipe_detail] external_id=%s", external_id)
        url = f"{self.base_url}/recipes/{external_id}/information"
        params = {"includeNutrition": True}

        data = await self._request(url, params)
        return self._parse_detail(data)

    async def search(
        self,
        query: str,
        dietary: list[str] | None = None,
        count: int = 20,
        offset: int = 0,
    ) -> tuple[list[RecipeSummary], int]:
        """Search recipes via /recipes/complexSearch."""
        logger.info(
            "[search] query=%r dietary=%s count=%d offset=%d",
            query,
            dietary,
            count,
            offset,
        )
        url = f"{self.base_url}/recipes/complexSearch"
        params = {
            "query": query,
            "number": count,
            "offset": offset,
            "fillIngredients": True,
        }
        if dietary:
            params["diet"] = ",".join(dietary)

        data = await self._request(url, params)
        total = data.get("totalResults", 0)
        results = []
        for item in data.get("results", []):
            results.append(self._parse_complex_result(item))
        logger.info("[search] returned %d of %d total results", len(results), total)
        return results, total

    async def _request(self, url: str, params: dict) -> dict | list:
        """Make an authenticated GET request to the Spoonacular API."""
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.get(url, params=params, headers=self._headers())
                resp.raise_for_status()
                return resp.json()
        except httpx.HTTPStatusError as exc:
            logger.exception("[_request] Spoonacular HTTP error url=%s", url)
            raise RecipeProviderError(f"Spoonacular API error: {exc.response.status_code}") from exc
        except httpx.HTTPError as exc:
            logger.exception("[_request] Spoonacular request failed url=%s", url)
            raise RecipeProviderError(f"Spoonacular request failed: {exc}") from exc

    def _parse_complex_result(self, item: dict) -> RecipeSummary:
        """Parse a single result from complexSearch response."""
        used = item.get("usedIngredients", [])
        missed = item.get("missedIngredients", [])
        return RecipeSummary(
            external_id=str(item["id"]),
            source="spoonacular",
            title=item["title"],
            image_url=item.get("image"),
            used_ingredient_count=item.get("usedIngredientCount", len(used)),
            missed_ingredient_count=item.get("missedIngredientCount", len(missed)),
            used_ingredients=[ing["name"] for ing in used],
            missed_ingredients=[ing["name"] for ing in missed],
        )

    def _parse_detail(self, data: dict) -> RecipeDetail:
        """Parse full recipe detail from /information response."""
        instructions = []
        for group in data.get("analyzedInstructions", []):
            for step in group.get("steps", []):
                instructions.append(
                    {
                        "step": step.get("number"),
                        "text": step.get("step", ""),
                    }
                )

        ingredients = []
        for ing in data.get("extendedIngredients", []):
            ingredients.append(
                {
                    "name": ing.get("name", ""),
                    "amount": ing.get("amount"),
                    "unit": ing.get("unit", ""),
                    "original": ing.get("original", ""),
                }
            )

        nutrition = None
        if data.get("nutrition"):
            nutrients = data["nutrition"].get("nutrients", [])
            nutrition = {n["name"].lower(): {"amount": n["amount"], "unit": n["unit"]} for n in nutrients}

        return RecipeDetail(
            external_id=str(data["id"]),
            source="spoonacular",
            title=data.get("title", ""),
            description=data.get("summary"),
            instructions=instructions,
            ingredients_json=ingredients,
            prep_time_minutes=data.get("preparationMinutes") or None,
            cook_time_minutes=data.get("cookingMinutes") or data.get("readyInMinutes"),
            servings=data.get("servings"),
            image_url=data.get("image"),
            nutrition=nutrition,
            source_url=data.get("sourceUrl"),
            diets=data.get("diets", []),
        )
