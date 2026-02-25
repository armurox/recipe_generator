import json
from unittest.mock import AsyncMock, patch

from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.test import TestCase

from apps.pantry.models import PantryItem
from apps.recipes.models import CookingLog, Recipe, SavedRecipe
from apps.recipes.services.base import RecipeDetail, RecipeProviderError, RecipeSummary
from tests.conftest import make_auth_header
from tests.factories import (
    CookingLogFactory,
    IngredientFactory,
    PantryItemFactory,
    RecipeFactory,
    SavedRecipeFactory,
    UserFactory,
)

BASE_URL = "/api/v1/recipes"


# ---------------------------------------------------------------------------
# Model tests (existing)
# ---------------------------------------------------------------------------


class RecipeTest(TestCase):
    def test_create(self):
        recipe = RecipeFactory(title="Tomato Pasta")
        self.assertEqual(recipe.title, "Tomato Pasta")
        self.assertEqual(recipe.source, "spoonacular")
        self.assertIsNotNone(recipe.pk)

    def test_unique_source_external_id(self):
        RecipeFactory(source="spoonacular", external_id="123")
        with self.assertRaises(IntegrityError):
            RecipeFactory(source="spoonacular", external_id="123")

    def test_str(self):
        recipe = RecipeFactory(title="Tomato Pasta")
        self.assertEqual(str(recipe), "Tomato Pasta")


class SavedRecipeTest(TestCase):
    def test_create(self):
        saved = SavedRecipeFactory(notes="Love this one")
        self.assertEqual(saved.notes, "Love this one")
        self.assertIsNotNone(saved.pk)

    def test_unique_user_recipe(self):
        user = UserFactory()
        recipe = RecipeFactory()
        SavedRecipeFactory(user=user, recipe=recipe)
        with self.assertRaises(IntegrityError):
            SavedRecipeFactory(user=user, recipe=recipe)

    def test_cascade_on_user_delete(self):
        saved = SavedRecipeFactory()
        saved.user.delete()
        self.assertEqual(SavedRecipe.objects.count(), 0)

    def test_cascade_on_recipe_delete(self):
        saved = SavedRecipeFactory()
        saved.recipe.delete()
        self.assertEqual(SavedRecipe.objects.count(), 0)


class CookingLogTest(TestCase):
    def test_create(self):
        log = CookingLogFactory(rating=5, notes="Delicious")
        self.assertEqual(log.rating, 5)
        self.assertIsNotNone(log.cooked_at)
        self.assertIsNotNone(log.pk)

    def test_rating_validators(self):
        log = CookingLogFactory.build(rating=6)
        with self.assertRaises(ValidationError):
            log.full_clean()

        log2 = CookingLogFactory.build(rating=0)
        with self.assertRaises(ValidationError):
            log2.full_clean()

    def test_rating_nullable(self):
        log = CookingLogFactory(rating=None)
        self.assertIsNone(log.rating)

    def test_ordering(self):
        user = UserFactory()
        recipe = RecipeFactory()
        log1 = CookingLogFactory(user=user, recipe=recipe)
        log2 = CookingLogFactory(user=user, recipe=recipe)
        logs = list(CookingLog.objects.all())
        self.assertEqual(logs[0], log2)  # most recent first
        self.assertEqual(logs[1], log1)


# ---------------------------------------------------------------------------
# Helper: mock provider data
# ---------------------------------------------------------------------------

MOCK_SUMMARY = RecipeSummary(
    external_id="12345",
    source="spoonacular",
    title="Pasta Primavera",
    image_url="https://spoonacular.com/pasta.jpg",
    used_ingredient_count=3,
    missed_ingredient_count=1,
    used_ingredients=["tomato", "onion", "garlic"],
    missed_ingredients=["basil"],
)

MOCK_SUMMARY_2 = RecipeSummary(
    external_id="67890",
    source="spoonacular",
    title="Chicken Stir Fry",
    image_url="https://spoonacular.com/chicken.jpg",
    used_ingredient_count=2,
    missed_ingredient_count=2,
    used_ingredients=["chicken", "onion"],
    missed_ingredients=["soy sauce", "ginger"],
)

MOCK_DETAIL = RecipeDetail(
    external_id="12345",
    source="spoonacular",
    title="Pasta Primavera",
    description="A delicious pasta dish",
    instructions=[{"step": 1, "text": "Boil pasta"}, {"step": 2, "text": "Add veggies"}],
    ingredients_json=[
        {"name": "pasta", "amount": 200, "unit": "g", "original": "200g pasta"},
        {"name": "tomato", "amount": 2, "unit": "", "original": "2 tomatoes"},
    ],
    prep_time_minutes=10,
    cook_time_minutes=20,
    servings=4,
    image_url="https://spoonacular.com/pasta.jpg",
    nutrition={"calories": {"amount": 350, "unit": "kcal"}},
    source_url="https://example.com/pasta",
    diets=["vegetarian"],
)


# ---------------------------------------------------------------------------
# Suggest endpoint tests
# ---------------------------------------------------------------------------


@patch("apps.recipes.api.recipe_provider")
class SuggestRecipesAPITest(TestCase):
    def setUp(self):
        self.user = UserFactory()
        self.auth = make_auth_header(self.user)

    def test_suggest_with_pantry_items(self, mock_provider):
        mock_provider.find_by_ingredients = AsyncMock(return_value=([MOCK_SUMMARY, MOCK_SUMMARY_2], None))
        ing1 = IngredientFactory(name="tomato")
        ing2 = IngredientFactory(name="onion")
        PantryItemFactory(user=self.user, ingredient=ing1, status=PantryItem.Status.AVAILABLE)
        PantryItemFactory(user=self.user, ingredient=ing2, status=PantryItem.Status.AVAILABLE)

        resp = self.client.get(f"{BASE_URL}/suggest", **self.auth)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data["using_pantry_ingredients"])
        self.assertEqual(len(data["items"]), 2)
        self.assertIsNone(data["total_results"])
        self.assertEqual(data["items"][0]["title"], "Pasta Primavera")
        self.assertEqual(data["items"][0]["used_ingredient_count"], 3)
        self.assertFalse(data["items"][0]["is_saved"])

        # Verify provider was called with ingredient names
        mock_provider.find_by_ingredients.assert_awaited_once()
        call_kwargs = mock_provider.find_by_ingredients.call_args
        ingredients_arg = call_kwargs.kwargs["ingredients"]
        self.assertIn("tomato", ingredients_arg)
        self.assertIn("onion", ingredients_arg)

    def test_suggest_empty_pantry_returns_popular(self, mock_provider):
        mock_provider.get_popular = AsyncMock(return_value=([MOCK_SUMMARY, MOCK_SUMMARY_2], 50))
        resp = self.client.get(f"{BASE_URL}/suggest", **self.auth)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertFalse(data["using_pantry_ingredients"])
        self.assertEqual(len(data["items"]), 2)
        self.assertEqual(data["total_results"], 50)
        mock_provider.find_by_ingredients.assert_not_called()
        mock_provider.get_popular.assert_awaited_once()

    def test_suggest_with_dietary_prefs(self, mock_provider):
        mock_provider.find_by_ingredients = AsyncMock(return_value=([MOCK_SUMMARY], 10))
        self.user.dietary_prefs = ["vegetarian"]
        self.user.save()

        ing = IngredientFactory(name="pasta")
        PantryItemFactory(user=self.user, ingredient=ing, status=PantryItem.Status.AVAILABLE)

        resp = self.client.get(f"{BASE_URL}/suggest", **self.auth)
        self.assertEqual(resp.status_code, 200)

        call_kwargs = mock_provider.find_by_ingredients.call_args
        self.assertEqual(call_kwargs.kwargs["dietary"], ["vegetarian"])

    def test_suggest_only_available_items(self, mock_provider):
        """Used-up and expired pantry items should not be included."""
        mock_provider.find_by_ingredients = AsyncMock(return_value=([], None))
        ing1 = IngredientFactory(name="fresh tomato")
        ing2 = IngredientFactory(name="old milk")

        PantryItemFactory(user=self.user, ingredient=ing1, status=PantryItem.Status.AVAILABLE)
        PantryItemFactory(user=self.user, ingredient=ing2, status=PantryItem.Status.EXPIRED)

        resp = self.client.get(f"{BASE_URL}/suggest", **self.auth)
        self.assertEqual(resp.status_code, 200)

        call_kwargs = mock_provider.find_by_ingredients.call_args
        ingredients_arg = call_kwargs.kwargs["ingredients"]
        self.assertIn("fresh tomato", ingredients_arg)
        self.assertNotIn("old milk", ingredients_arg)

    def test_suggest_provider_error(self, mock_provider):
        mock_provider.find_by_ingredients = AsyncMock(side_effect=RecipeProviderError("API down"))
        ing = IngredientFactory(name="tomato")
        PantryItemFactory(user=self.user, ingredient=ing, status=PantryItem.Status.AVAILABLE)

        resp = self.client.get(f"{BASE_URL}/suggest", **self.auth)
        self.assertEqual(resp.status_code, 502)

    def test_suggest_is_saved_annotation(self, mock_provider):
        """Saved recipes should be annotated with is_saved=True."""
        mock_provider.find_by_ingredients = AsyncMock(return_value=([MOCK_SUMMARY, MOCK_SUMMARY_2], None))
        recipe = RecipeFactory(source="spoonacular", external_id="12345")
        SavedRecipeFactory(user=self.user, recipe=recipe)

        ing = IngredientFactory(name="tomato")
        PantryItemFactory(user=self.user, ingredient=ing, status=PantryItem.Status.AVAILABLE)

        resp = self.client.get(f"{BASE_URL}/suggest", **self.auth)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        items = data["items"]
        # 12345 is saved, 67890 is not
        saved_item = next(d for d in items if d["external_id"] == "12345")
        unsaved_item = next(d for d in items if d["external_id"] == "67890")
        self.assertTrue(saved_item["is_saved"])
        self.assertFalse(unsaved_item["is_saved"])

    def test_suggest_unauthenticated(self, mock_provider):
        resp = self.client.get(f"{BASE_URL}/suggest")
        self.assertEqual(resp.status_code, 401)

    def test_suggest_pagination(self, mock_provider):
        mock_provider.find_by_ingredients = AsyncMock(return_value=([MOCK_SUMMARY], 50))
        ing = IngredientFactory(name="tomato")
        PantryItemFactory(user=self.user, ingredient=ing, status=PantryItem.Status.AVAILABLE)

        resp = self.client.get(f"{BASE_URL}/suggest?page=2&page_size=10", **self.auth)
        self.assertEqual(resp.status_code, 200)
        call_kwargs = mock_provider.find_by_ingredients.call_args
        self.assertEqual(call_kwargs.kwargs["count"], 10)
        self.assertEqual(call_kwargs.kwargs["offset"], 10)  # (2-1)*10


# ---------------------------------------------------------------------------
# Get recipe detail tests
# ---------------------------------------------------------------------------


@patch("apps.recipes.api.recipe_provider")
class GetRecipeAPITest(TestCase):
    def setUp(self):
        self.user = UserFactory()
        self.auth = make_auth_header(self.user)

    def test_get_cached_recipe(self, mock_provider):
        """Recipe already in DB — no provider call needed."""
        recipe = RecipeFactory(
            source="spoonacular",
            external_id="12345",
            title="Pasta Primavera",
            description="Tasty pasta",
        )
        resp = self.client.get(f"{BASE_URL}/{recipe.id}", **self.auth)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["title"], "Pasta Primavera")
        self.assertEqual(data["id"], str(recipe.id))
        self.assertFalse(data["is_saved"])
        mock_provider.get_recipe_detail.assert_not_called()

    def test_get_uncached_recipe_by_external_id(self, mock_provider):
        """Recipe not in DB — fetched from Spoonacular and cached."""
        mock_provider.get_recipe_detail = AsyncMock(return_value=MOCK_DETAIL)

        resp = self.client.get(f"{BASE_URL}/12345", **self.auth)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["title"], "Pasta Primavera")
        self.assertIsNotNone(data["id"])

        # Verify it was cached in DB
        self.assertTrue(Recipe.objects.filter(external_id="12345", source="spoonacular").exists())
        mock_provider.get_recipe_detail.assert_awaited_once_with("12345")

    def test_get_recipe_is_saved(self, mock_provider):
        recipe = RecipeFactory(source="spoonacular", external_id="12345")
        SavedRecipeFactory(user=self.user, recipe=recipe)

        resp = self.client.get(f"{BASE_URL}/{recipe.id}", **self.auth)
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.json()["is_saved"])

    def test_get_recipe_provider_error(self, mock_provider):
        mock_provider.get_recipe_detail = AsyncMock(side_effect=RecipeProviderError("timeout"))

        resp = self.client.get(f"{BASE_URL}/99999", **self.auth)
        self.assertEqual(resp.status_code, 502)

    def test_get_recipe_by_cached_external_id(self, mock_provider):
        """Lookup by external_id when recipe is already cached."""
        recipe = RecipeFactory(source="spoonacular", external_id="55555")

        resp = self.client.get(f"{BASE_URL}/55555", **self.auth)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["id"], str(recipe.id))
        mock_provider.get_recipe_detail.assert_not_called()

    def test_get_recipe_unauthenticated(self, mock_provider):
        resp = self.client.get(f"{BASE_URL}/12345")
        self.assertEqual(resp.status_code, 401)


# ---------------------------------------------------------------------------
# Search endpoint tests
# ---------------------------------------------------------------------------


@patch("apps.recipes.api.recipe_provider")
class SearchRecipesAPITest(TestCase):
    def setUp(self):
        self.user = UserFactory()
        self.auth = make_auth_header(self.user)

    def test_basic_search(self, mock_provider):
        mock_provider.search = AsyncMock(return_value=([MOCK_SUMMARY], 1))

        resp = self.client.get(f"{BASE_URL}/search?q=pasta", **self.auth)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(len(data["items"]), 1)
        self.assertEqual(data["total_results"], 1)
        self.assertEqual(data["items"][0]["title"], "Pasta Primavera")

    def test_search_with_diet_filter(self, mock_provider):
        mock_provider.search = AsyncMock(return_value=([], 0))

        resp = self.client.get(f"{BASE_URL}/search?q=pasta&diet=vegan", **self.auth)
        self.assertEqual(resp.status_code, 200)

        call_kwargs = mock_provider.search.call_args
        self.assertIn("vegan", call_kwargs.kwargs["dietary"])

    def test_search_merges_user_prefs(self, mock_provider):
        """User dietary_prefs are merged with explicit diet param."""
        mock_provider.search = AsyncMock(return_value=([], 0))
        self.user.dietary_prefs = ["vegetarian"]
        self.user.save()

        resp = self.client.get(f"{BASE_URL}/search?q=pasta&diet=gluten free", **self.auth)
        self.assertEqual(resp.status_code, 200)

        call_kwargs = mock_provider.search.call_args
        dietary = call_kwargs.kwargs["dietary"]
        self.assertIn("vegetarian", dietary)
        self.assertIn("gluten free", dietary)

    def test_search_empty_query_no_diet(self, mock_provider):
        resp = self.client.get(f"{BASE_URL}/search?q=", **self.auth)
        self.assertEqual(resp.status_code, 400)

    def test_search_missing_query_no_diet(self, mock_provider):
        resp = self.client.get(f"{BASE_URL}/search", **self.auth)
        self.assertEqual(resp.status_code, 400)

    def test_search_diet_only_no_query(self, mock_provider):
        """Diet-only search (no q) should work — used by filter tabs."""
        mock_provider.search = AsyncMock(return_value=([MOCK_SUMMARY], 25))

        resp = self.client.get(f"{BASE_URL}/search?diet=vegetarian", **self.auth)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(len(data["items"]), 1)
        self.assertEqual(data["total_results"], 25)

        call_kwargs = mock_provider.search.call_args
        self.assertEqual(call_kwargs.kwargs["query"], "")
        self.assertIn("vegetarian", call_kwargs.kwargs["dietary"])

    def test_search_provider_error(self, mock_provider):
        mock_provider.search = AsyncMock(side_effect=RecipeProviderError("API down"))

        resp = self.client.get(f"{BASE_URL}/search?q=pasta", **self.auth)
        self.assertEqual(resp.status_code, 502)

    def test_search_max_ready_time(self, mock_provider):
        """max_ready_time filter should be passed to provider — used by Quick Meals tab."""
        mock_provider.search = AsyncMock(return_value=([MOCK_SUMMARY], 100))

        resp = self.client.get(f"{BASE_URL}/search?max_ready_time=30", **self.auth)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(len(data["items"]), 1)
        self.assertEqual(data["total_results"], 100)

        call_kwargs = mock_provider.search.call_args
        self.assertEqual(call_kwargs.kwargs["max_ready_time"], 30)

    def test_search_pagination(self, mock_provider):
        mock_provider.search = AsyncMock(return_value=([MOCK_SUMMARY], 50))

        resp = self.client.get(f"{BASE_URL}/search?q=pasta&page=3&page_size=10", **self.auth)
        self.assertEqual(resp.status_code, 200)

        call_kwargs = mock_provider.search.call_args
        self.assertEqual(call_kwargs.kwargs["offset"], 20)  # (3-1)*10
        self.assertEqual(call_kwargs.kwargs["count"], 10)


# ---------------------------------------------------------------------------
# Save / unsave recipe tests
# ---------------------------------------------------------------------------


@patch("apps.recipes.api.recipe_provider")
class SaveRecipeAPITest(TestCase):
    def setUp(self):
        self.user = UserFactory()
        self.auth = make_auth_header(self.user)

    def test_save_cached_recipe(self, mock_provider):
        recipe = RecipeFactory(source="spoonacular", external_id="12345")

        resp = self.client.post(
            f"{BASE_URL}/{recipe.id}/save",
            data=json.dumps({"notes": "Looks great"}),
            content_type="application/json",
            **self.auth,
        )
        self.assertEqual(resp.status_code, 201)
        data = resp.json()
        self.assertEqual(data["recipe"]["title"], recipe.title)
        self.assertEqual(data["notes"], "Looks great")
        self.assertTrue(data["recipe"]["is_saved"])

    def test_save_uncached_recipe(self, mock_provider):
        """Saving a recipe by external_id caches it first."""
        mock_provider.get_recipe_detail = AsyncMock(return_value=MOCK_DETAIL)

        resp = self.client.post(
            f"{BASE_URL}/12345/save",
            content_type="application/json",
            **self.auth,
        )
        self.assertEqual(resp.status_code, 201)

        # Recipe should now be cached
        self.assertTrue(Recipe.objects.filter(external_id="12345").exists())
        self.assertEqual(SavedRecipe.objects.filter(user=self.user).count(), 1)

    def test_save_already_saved(self, mock_provider):
        recipe = RecipeFactory(source="spoonacular", external_id="12345")
        SavedRecipeFactory(user=self.user, recipe=recipe)

        resp = self.client.post(
            f"{BASE_URL}/{recipe.id}/save",
            content_type="application/json",
            **self.auth,
        )
        self.assertEqual(resp.status_code, 409)

    def test_unsave_recipe(self, mock_provider):
        recipe = RecipeFactory(source="spoonacular", external_id="12345")
        SavedRecipeFactory(user=self.user, recipe=recipe)

        resp = self.client.delete(f"{BASE_URL}/{recipe.id}/save", **self.auth)
        self.assertEqual(resp.status_code, 204)
        self.assertEqual(SavedRecipe.objects.filter(user=self.user).count(), 0)

    def test_unsave_not_saved(self, mock_provider):
        recipe = RecipeFactory(source="spoonacular", external_id="12345")

        resp = self.client.delete(f"{BASE_URL}/{recipe.id}/save", **self.auth)
        self.assertEqual(resp.status_code, 404)


# ---------------------------------------------------------------------------
# List saved recipes tests
# ---------------------------------------------------------------------------


@patch("apps.recipes.api.recipe_provider")
class ListSavedRecipesAPITest(TestCase):
    def setUp(self):
        self.user = UserFactory()
        self.auth = make_auth_header(self.user)

    def test_list_saved(self, mock_provider):
        recipe = RecipeFactory(source="spoonacular", external_id="111")
        SavedRecipeFactory(user=self.user, recipe=recipe, notes="My fave")

        resp = self.client.get(f"{BASE_URL}/saved", **self.auth)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["count"], 1)
        self.assertEqual(data["items"][0]["recipe"]["title"], recipe.title)
        self.assertEqual(data["items"][0]["notes"], "My fave")

    def test_list_saved_empty(self, mock_provider):
        resp = self.client.get(f"{BASE_URL}/saved", **self.auth)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["count"], 0)

    def test_list_saved_own_only(self, mock_provider):
        """Should not see other users' saved recipes."""
        other_user = UserFactory()
        recipe = RecipeFactory()
        SavedRecipeFactory(user=other_user, recipe=recipe)

        resp = self.client.get(f"{BASE_URL}/saved", **self.auth)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["count"], 0)


# ---------------------------------------------------------------------------
# Log cooking tests
# ---------------------------------------------------------------------------


@patch("apps.recipes.api.recipe_provider")
class LogCookingAPITest(TestCase):
    def setUp(self):
        self.user = UserFactory()
        self.auth = make_auth_header(self.user)

    def test_log_with_rating(self, mock_provider):
        recipe = RecipeFactory(source="spoonacular", external_id="12345")

        resp = self.client.post(
            f"{BASE_URL}/{recipe.id}/cooked",
            data=json.dumps({"rating": 5, "notes": "Delicious!"}),
            content_type="application/json",
            **self.auth,
        )
        self.assertEqual(resp.status_code, 201)
        data = resp.json()
        self.assertEqual(data["rating"], 5)
        self.assertEqual(data["notes"], "Delicious!")
        self.assertEqual(data["recipe_title"], recipe.title)

    def test_log_without_rating(self, mock_provider):
        recipe = RecipeFactory(source="spoonacular", external_id="12345")

        resp = self.client.post(
            f"{BASE_URL}/{recipe.id}/cooked",
            content_type="application/json",
            **self.auth,
        )
        self.assertEqual(resp.status_code, 201)
        data = resp.json()
        self.assertIsNone(data["rating"])
        self.assertIsNone(data["notes"])

    def test_log_invalid_rating(self, mock_provider):
        recipe = RecipeFactory(source="spoonacular", external_id="12345")

        resp = self.client.post(
            f"{BASE_URL}/{recipe.id}/cooked",
            data=json.dumps({"rating": 6}),
            content_type="application/json",
            **self.auth,
        )
        self.assertEqual(resp.status_code, 422)

    def test_log_uncached_recipe(self, mock_provider):
        """Logging a cook for an uncached recipe fetches and caches it first."""
        mock_provider.get_recipe_detail = AsyncMock(return_value=MOCK_DETAIL)

        resp = self.client.post(
            f"{BASE_URL}/12345/cooked",
            content_type="application/json",
            **self.auth,
        )
        self.assertEqual(resp.status_code, 201)
        self.assertTrue(Recipe.objects.filter(external_id="12345").exists())
        self.assertEqual(CookingLog.objects.filter(user=self.user).count(), 1)


# ---------------------------------------------------------------------------
# Cooking history tests
# ---------------------------------------------------------------------------


@patch("apps.recipes.api.recipe_provider")
class CookingHistoryAPITest(TestCase):
    def setUp(self):
        self.user = UserFactory()
        self.auth = make_auth_header(self.user)

    def test_history_list(self, mock_provider):
        recipe = RecipeFactory()
        CookingLogFactory(user=self.user, recipe=recipe, rating=4)
        CookingLogFactory(user=self.user, recipe=recipe, rating=5)

        resp = self.client.get(f"{BASE_URL}/history", **self.auth)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["count"], 2)
        # Newest first
        self.assertEqual(data["items"][0]["rating"], 5)
        self.assertEqual(data["items"][1]["rating"], 4)

    def test_history_empty(self, mock_provider):
        resp = self.client.get(f"{BASE_URL}/history", **self.auth)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["count"], 0)

    def test_history_own_only(self, mock_provider):
        other_user = UserFactory()
        recipe = RecipeFactory()
        CookingLogFactory(user=other_user, recipe=recipe)

        resp = self.client.get(f"{BASE_URL}/history", **self.auth)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["count"], 0)
