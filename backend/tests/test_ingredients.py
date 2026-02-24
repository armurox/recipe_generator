from django.core.management import call_command
from django.db import IntegrityError
from django.test import TestCase

from apps.ingredients.models import IngredientCategory
from tests.factories import IngredientCategoryFactory, IngredientFactory


class IngredientCategoryTest(TestCase):
    def test_create(self):
        cat = IngredientCategoryFactory(name="Dairy", default_shelf_life=10, icon="🥛")
        self.assertEqual(cat.name, "Dairy")
        self.assertEqual(cat.default_shelf_life, 10)
        self.assertEqual(cat.default_shelf_life_unit, "days")
        self.assertIsNotNone(cat.pk)

    def test_name_unique(self):
        IngredientCategoryFactory(name="Dairy")
        with self.assertRaises(IntegrityError):
            IngredientCategoryFactory(name="Dairy")

    def test_str(self):
        cat = IngredientCategoryFactory(name="Fresh Vegetables")
        self.assertEqual(str(cat), "Fresh Vegetables")


class IngredientTest(TestCase):
    def test_create(self):
        ing = IngredientFactory(name="tomatoes", common_unit="piece")
        self.assertEqual(ing.name, "tomatoes")
        self.assertIsNotNone(ing.category)
        self.assertIsNotNone(ing.pk)

    def test_name_normalized(self):
        ing = IngredientFactory(name="  Olive Oil  ")
        self.assertEqual(ing.name, "olive oil")

    def test_name_unique(self):
        IngredientFactory(name="tomatoes")
        with self.assertRaises(IntegrityError):
            IngredientFactory(name="tomatoes")

    def test_category_set_null(self):
        ing = IngredientFactory()
        category = ing.category
        category.delete()
        ing.refresh_from_db()
        self.assertIsNone(ing.category)

    def test_str(self):
        ing = IngredientFactory(name="tomatoes")
        self.assertEqual(str(ing), "tomatoes")


class SeedCategoriesTest(TestCase):
    def test_seeds_25_categories(self):
        call_command("seed_categories")
        self.assertEqual(IngredientCategory.objects.count(), 25)

    def test_idempotent(self):
        call_command("seed_categories")
        call_command("seed_categories")
        self.assertEqual(IngredientCategory.objects.count(), 25)
