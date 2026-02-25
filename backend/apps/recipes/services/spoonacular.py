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
        offset: int = 0,
    ) -> tuple[list[RecipeSummary], int | None]:
        """Find recipes by ingredient list.

        When dietary prefs are present or offset > 0, uses complexSearch with
        includeIngredients + diet, since findByIngredients doesn't support
        diet filters or reliable offset pagination.
        """
        logger.info(
            "[find_by_ingredients] ingredients=%d count=%d dietary=%s offset=%d",
            len(ingredients),
            count,
            dietary,
            offset,
        )

        if dietary or offset > 0:
            return await self._find_by_ingredients_complex(ingredients, count, dietary or [], offset)
        return await self._find_by_ingredients_simple(ingredients, count)

    async def _find_by_ingredients_simple(self, ingredients: list[str], count: int) -> tuple[list[RecipeSummary], None]:
        """Use /recipes/findByIngredients — provides used/missed ingredient data.

        Returns (results, None) since this endpoint doesn't report total_results.
        Only used for first-page requests without dietary filters.
        """
        url = f"{self.base_url}/recipes/findByIngredients"
        params = {
            "ingredients": ",".join(ingredients),
            "number": count,
            "ranking": 2,  # Minimize missing ingredients
            "ignorePantry": "true",
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
        return results, None

    async def _find_by_ingredients_complex(
        self, ingredients: list[str], count: int, dietary: list[str], offset: int = 0
    ) -> tuple[list[RecipeSummary], int]:
        """Use /recipes/complexSearch with includeIngredients + diet.

        Decision: findByIngredients doesn't support diet filters or reliable
        pagination. When dietary prefs are present or offset > 0, we use
        complexSearch instead, which provides totalResults for pagination.
        """
        url = f"{self.base_url}/recipes/complexSearch"
        params = {
            "includeIngredients": ",".join(ingredients),
            "number": count,
            "offset": offset,
            "sort": "min-missing-ingredients",
            "fillIngredients": "true",
        }
        if dietary:
            params["diet"] = ",".join(dietary)

        data = await self._request(url, params)
        total = data.get("totalResults", 0)
        results = []
        for item in data.get("results", []):
            results.append(self._parse_complex_result(item))
        logger.info("[find_by_ingredients_complex] returned %d of %d total results", len(results), total)
        return results, total

    async def get_popular(
        self,
        count: int = 10,
        dietary: list[str] | None = None,
        offset: int = 0,
    ) -> tuple[list[RecipeSummary], int]:
        """Get popular recipes via /recipes/complexSearch sorted by popularity.

        Decision: Uses complexSearch with sort=popularity and no query/ingredients,
        providing a generic fallback when the user's pantry is empty.
        """
        logger.info("[get_popular] count=%d dietary=%s offset=%d", count, dietary, offset)
        url = f"{self.base_url}/recipes/complexSearch"
        params = {
            "sort": "popularity",
            "number": count,
            "offset": offset,
        }
        if dietary:
            params["diet"] = ",".join(dietary)

        data = await self._request(url, params)
        total = data.get("totalResults", 0)
        results = []
        for item in data.get("results", []):
            results.append(self._parse_complex_result(item))

        # complexSearch doesn't include extendedIngredients, so batch-fetch
        # recipe details to get ingredient lists for UI display.
        if results:
            ids = [r.external_id for r in results]
            ingredients_by_id = await self._bulk_fetch_ingredients(ids)
            for summary in results:
                if not summary.missed_ingredients and summary.external_id in ingredients_by_id:
                    summary.missed_ingredients = ingredients_by_id[summary.external_id]
                    summary.missed_ingredient_count = len(summary.missed_ingredients)

        logger.info("[get_popular] returned %d of %d total results", len(results), total)
        return results, total

    async def get_recipe_detail(self, external_id: str) -> RecipeDetail:
        """Fetch full recipe details from /recipes/{id}/information."""
        logger.info("[get_recipe_detail] external_id=%s", external_id)
        url = f"{self.base_url}/recipes/{external_id}/information"
        params = {"includeNutrition": "true"}

        data = await self._request(url, params)
        return self._parse_detail(data)

    async def search(
        self,
        query: str,
        dietary: list[str] | None = None,
        count: int = 20,
        offset: int = 0,
        max_ready_time: int | None = None,
    ) -> tuple[list[RecipeSummary], int]:
        """Search recipes via /recipes/complexSearch."""
        logger.info(
            "[search] query=%r dietary=%s count=%d offset=%d max_ready_time=%s",
            query,
            dietary,
            count,
            offset,
            max_ready_time,
        )
        url = f"{self.base_url}/recipes/complexSearch"
        params = {
            "number": count,
            "offset": offset,
            "fillIngredients": "true",
        }
        if query:
            params["query"] = query
        if dietary:
            params["diet"] = ",".join(dietary)
        if max_ready_time is not None:
            params["maxReadyTime"] = max_ready_time

        data = await self._request(url, params)
        total = data.get("totalResults", 0)
        results = []
        for item in data.get("results", []):
            results.append(self._parse_complex_result(item))
        logger.info("[search] returned %d of %d total results", len(results), total)
        return results, total

    async def _bulk_fetch_ingredients(self, ids: list[str]) -> dict[str, list[str]]:
        """Fetch ingredient names for multiple recipes via /recipes/informationBulk.

        Returns a dict mapping external_id → list of ingredient names.
        Single API call regardless of how many IDs (up to 100).
        """
        url = f"{self.base_url}/recipes/informationBulk"
        params = {"ids": ",".join(ids)}

        try:
            data = await self._request(url, params)
        except RecipeProviderError:
            logger.warning("[_bulk_fetch_ingredients] failed, returning empty")
            return {}

        result: dict[str, list[str]] = {}
        for recipe in data:
            ext_id = str(recipe.get("id", ""))
            ingredients = [ing.get("name", "") for ing in recipe.get("extendedIngredients", [])]
            result[ext_id] = ingredients
        logger.info("[_bulk_fetch_ingredients] fetched ingredients for %d recipes", len(result))
        return result

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
