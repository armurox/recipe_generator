from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.test import TestCase

from apps.recipes.models import CookingLog, SavedRecipe
from tests.factories import CookingLogFactory, RecipeFactory, SavedRecipeFactory, UserFactory


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
