import logging
from datetime import date, timedelta

from apps.ingredients.models import Ingredient, IngredientCategory

logger = logging.getLogger(__name__)


async def get_or_create_category(name: str) -> IngredientCategory:
    """Get or create an ingredient category by name.

    New categories get a default shelf life of 7 days.
    """
    category, created = await IngredientCategory.objects.aget_or_create(
        name=name,
        defaults={"default_shelf_life": 7},
    )
    if created:
        logger.info("[get_or_create_category] created category=%s", name)
    return category


async def update_ingredient_category(ingredient: Ingredient, category_hint: str) -> None:
    """Update an ingredient's category. Creates the category if it doesn't exist."""
    category = await get_or_create_category(category_hint)
    if ingredient.category_id != category.id:
        ingredient.category = category
        await ingredient.asave()
        logger.info("[update_ingredient_category] ingredient=%s category=%s", ingredient.name, category_hint)


async def get_or_create_ingredient(name: str, category_hint: str | None, unit: str | None) -> Ingredient:
    """Normalize ingredient name and get or create the Ingredient record.

    If a category_hint is provided, try to match it to an existing IngredientCategory.
    """
    normalized = name.lower().strip()
    defaults = {}
    if unit:
        defaults["common_unit"] = unit

    ingredient, created = await Ingredient.objects.aget_or_create(name=normalized, defaults=defaults)

    # Assign category if hint provided and ingredient has no category yet
    if created and category_hint:
        category = await get_or_create_category(category_hint)
        ingredient.category = category
        await ingredient.asave()

    if created:
        logger.debug("[get_or_create_ingredient] created ingredient=%s category=%s", normalized, category_hint)

    return ingredient


async def calculate_expiry_date(ingredient: Ingredient) -> date | None:
    """Calculate expiry date based on ingredient's category shelf life."""
    if not ingredient.category_id:
        return None

    try:
        category = await IngredientCategory.objects.aget(id=ingredient.category_id)
        return date.today() + timedelta(days=category.default_shelf_life)
    except IngredientCategory.DoesNotExist:
        return None
