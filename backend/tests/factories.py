import uuid

import factory

from apps.ingredients.models import Ingredient, IngredientCategory
from apps.pantry.models import PantryItem
from apps.receipts.models import ReceiptItem, ReceiptScan
from apps.recipes.models import CookingLog, Recipe, SavedRecipe
from apps.users.models import User


class UserFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = User

    id = factory.LazyFunction(uuid.uuid4)
    email = factory.Sequence(lambda n: f"user{n}@example.com")
    display_name = factory.Faker("name")

    @classmethod
    def _create(cls, model_class, *args, **kwargs):
        manager = cls._get_manager(model_class)
        return manager.create_user(*args, **kwargs)


class IngredientCategoryFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = IngredientCategory

    name = factory.Sequence(lambda n: f"Category {n}")
    default_shelf_life = 7
    icon = "🥬"


class IngredientFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Ingredient

    name = factory.Sequence(lambda n: f"ingredient {n}")
    category = factory.SubFactory(IngredientCategoryFactory)
    common_unit = "piece"


class ReceiptScanFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = ReceiptScan

    user = factory.SubFactory(UserFactory)
    image_url = factory.Faker("url")
    status = ReceiptScan.Status.COMPLETED


class ReceiptItemFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = ReceiptItem

    receipt = factory.SubFactory(ReceiptScanFactory)
    raw_text = factory.Faker("sentence", nb_words=3)


class RecipeFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Recipe

    source = "spoonacular"
    external_id = factory.Sequence(lambda n: str(n))
    title = factory.Faker("sentence", nb_words=3)
    instructions = factory.LazyFunction(lambda: [{"step": 1, "text": "Cook it"}])
    ingredients_json = factory.LazyFunction(lambda: [{"name": "salt", "amount": 1}])
    servings = 4


class SavedRecipeFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = SavedRecipe

    user = factory.SubFactory(UserFactory)
    recipe = factory.SubFactory(RecipeFactory)


class CookingLogFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = CookingLog

    user = factory.SubFactory(UserFactory)
    recipe = factory.SubFactory(RecipeFactory)


class PantryItemFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = PantryItem

    user = factory.SubFactory(UserFactory)
    ingredient = factory.SubFactory(IngredientFactory)
