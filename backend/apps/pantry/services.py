import logging
from datetime import date, timedelta

from apps.ingredients.models import Ingredient, IngredientCategory

logger = logging.getLogger(__name__)


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
        try:
            category = await IngredientCategory.objects.aget(name=category_hint)
            ingredient.category = category
            await ingredient.asave()
        except IngredientCategory.DoesNotExist:
            pass

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
