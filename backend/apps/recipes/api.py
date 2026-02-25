import logging

from django.core.exceptions import ValidationError
from django.db import IntegrityError
from ninja import Router
from ninja.errors import HttpError
from ninja.pagination import PageNumberPagination, paginate

from apps.core.schemas import ErrorOut
from apps.pantry.models import PantryItem
from apps.recipes.models import CookingLog, Recipe, SavedRecipe
from apps.recipes.schemas import (
    CookingLogIn,
    CookingLogOut,
    RecipeDetailOut,
    RecipeSummaryOut,
    SavedRecipeOut,
    SaveRecipeNotesIn,
    SearchResultsOut,
    SuggestRecipesOut,
)
from apps.recipes.services.base import RecipeProviderError
from apps.recipes.services.spoonacular import SpoonacularProvider

logger = logging.getLogger(__name__)

router = Router(tags=["recipes"])

# Module-level provider instance for easy test patching
recipe_provider = SpoonacularProvider()


async def _resolve_recipe(recipe_id: str, fetch_if_missing: bool = True) -> Recipe:
    """Resolve a recipe by internal UUID or Spoonacular external_id.

    Decision: Accept either format to allow flexible client usage — internal
    UUID for cached recipes, external_id for fresh results from suggest/search.
    When fetch_if_missing=True, fetches from Spoonacular and caches in DB.
    """
    # Try UUID lookup first
    try:
        return await Recipe.objects.aget(id=recipe_id)
    except (Recipe.DoesNotExist, ValueError, ValidationError):
        pass

    # Try external_id lookup
    try:
        return await Recipe.objects.aget(external_id=recipe_id, source="spoonacular")
    except Recipe.DoesNotExist:
        pass

    if not fetch_if_missing:
        raise HttpError(404, "Recipe not found")

    # Fetch from Spoonacular and cache
    logger.info("[_resolve_recipe] fetching from Spoonacular external_id=%s", recipe_id)
    try:
        detail = await recipe_provider.get_recipe_detail(recipe_id)
    except RecipeProviderError as exc:
        logger.exception("[_resolve_recipe] provider error for %s", recipe_id)
        raise HttpError(502, f"Failed to fetch recipe: {exc}") from exc

    recipe, _created = await Recipe.objects.aget_or_create(
        source=detail.source,
        external_id=detail.external_id,
        defaults={
            "title": detail.title,
            "description": detail.description,
            "instructions": detail.instructions,
            "ingredients_json": detail.ingredients_json,
            "prep_time_minutes": detail.prep_time_minutes,
            "cook_time_minutes": detail.cook_time_minutes,
            "servings": detail.servings,
            "image_url": detail.image_url,
            "nutrition": detail.nutrition,
            "source_url": detail.source_url,
        },
    )
    return recipe


async def _annotate_is_saved(user, summaries: list[RecipeSummaryOut]) -> list[RecipeSummaryOut]:
    """Batch-annotate is_saved on a list of recipe summaries."""
    external_ids = [s.external_id for s in summaries]
    saved_external_ids = set()

    # Check which external_ids the user has saved
    async for ext_id in SavedRecipe.objects.filter(
        user=user,
        recipe__external_id__in=external_ids,
        recipe__source="spoonacular",
    ).values_list("recipe__external_id", flat=True):
        saved_external_ids.add(ext_id)

    for summary in summaries:
        summary.is_saved = summary.external_id in saved_external_ids

    return summaries


# ---------------------------------------------------------------------------
# Literal path endpoints (defined BEFORE {recipe_id} to avoid route conflicts)
# ---------------------------------------------------------------------------


@router.get("/suggest", response=SuggestRecipesOut)
async def suggest_recipes(request, count: int = 10):
    """Suggest recipes based on the user's available pantry ingredients.

    Queries the pantry for available items, extracts ingredient names, and
    asks the recipe provider for matching recipes. Respects the user's
    dietary_prefs if set.

    Decision: When the pantry is empty, returns popular recipes as a fallback
    with using_pantry_ingredients=False so the frontend can adjust its messaging.
    """
    user = request.auth
    logger.info("[suggest_recipes] user=%s count=%d", user.id, count)

    dietary = user.dietary_prefs if user.dietary_prefs else None

    # Get available pantry ingredient names
    ingredient_names = [
        name
        async for name in PantryItem.objects.filter(
            user=user,
            status=PantryItem.Status.AVAILABLE,
        )
        .select_related("ingredient")
        .values_list("ingredient__name", flat=True)
    ]

    using_pantry = bool(ingredient_names)

    try:
        if ingredient_names:
            summaries = await recipe_provider.find_by_ingredients(
                ingredients=ingredient_names,
                count=count,
                dietary=dietary,
            )
        else:
            logger.info("[suggest_recipes] user=%s has empty pantry, fetching popular recipes", user.id)
            summaries = await recipe_provider.get_popular(
                count=count,
                dietary=dietary,
            )
    except RecipeProviderError as exc:
        logger.exception("[suggest_recipes] provider error for user=%s", user.id)
        raise HttpError(502, f"Recipe service error: {exc}") from exc

    # Build response with is_saved annotation
    results = [
        RecipeSummaryOut(
            external_id=s.external_id,
            source=s.source,
            title=s.title,
            image_url=s.image_url,
            used_ingredient_count=s.used_ingredient_count,
            missed_ingredient_count=s.missed_ingredient_count,
            used_ingredients=s.used_ingredients,
            missed_ingredients=s.missed_ingredients,
        )
        for s in summaries
    ]

    # Check cache for internal IDs
    async for recipe in Recipe.objects.filter(
        source="spoonacular",
        external_id__in=[r.external_id for r in results],
    ):
        for r in results:
            if r.external_id == recipe.external_id:
                r.id = recipe.id

    results = await _annotate_is_saved(user, results)
    return SuggestRecipesOut(using_pantry_ingredients=using_pantry, items=results)


@router.get("/search", response=SearchResultsOut)
async def search_recipes(
    request,
    q: str = "",
    diet: str | None = None,
    page: int = 1,
    page_size: int = 20,
):
    """Search recipes by keyword with optional diet filter.

    Decision: No @paginate decorator — offset calculated and passed directly
    to Spoonacular since it provides total_results for proper pagination.
    Diet param is merged with user's dietary_prefs.
    """
    if not q.strip():
        raise HttpError(400, "Search query 'q' is required")

    user = request.auth
    offset = (page - 1) * page_size

    # Merge explicit diet param with user preferences
    dietary = list(user.dietary_prefs) if user.dietary_prefs else []
    if diet:
        for d in diet.split(","):
            d = d.strip()
            if d and d not in dietary:
                dietary.append(d)
    dietary = dietary or None

    logger.info(
        "[search_recipes] user=%s q=%r dietary=%s page=%d",
        user.id,
        q,
        dietary,
        page,
    )

    try:
        summaries, total = await recipe_provider.search(
            query=q,
            dietary=dietary,
            count=page_size,
            offset=offset,
        )
    except RecipeProviderError as exc:
        logger.exception("[search_recipes] provider error")
        raise HttpError(502, f"Recipe service error: {exc}") from exc

    results = [
        RecipeSummaryOut(
            external_id=s.external_id,
            source=s.source,
            title=s.title,
            image_url=s.image_url,
            used_ingredient_count=s.used_ingredient_count,
            missed_ingredient_count=s.missed_ingredient_count,
            used_ingredients=s.used_ingredients,
            missed_ingredients=s.missed_ingredients,
        )
        for s in summaries
    ]

    # Check cache for internal IDs
    async for recipe in Recipe.objects.filter(
        source="spoonacular",
        external_id__in=[r.external_id for r in results],
    ):
        for r in results:
            if r.external_id == recipe.external_id:
                r.id = recipe.id

    results = await _annotate_is_saved(user, results)
    return SearchResultsOut(items=results, total_results=total)


@router.get("/saved", response=list[SavedRecipeOut])
@paginate(PageNumberPagination, page_size=20)
async def list_saved_recipes(request):
    """List the authenticated user's saved recipes.

    Returns saved recipes with full recipe details, ordered by most recently saved.
    """
    return SavedRecipe.objects.filter(user=request.auth).select_related("recipe").order_by("-created_at")


@router.get("/history", response=list[CookingLogOut])
@paginate(PageNumberPagination, page_size=20)
async def cooking_history(request):
    """List the authenticated user's cooking history, newest first.

    Returns denormalized recipe info (title, image) alongside log data.
    """
    logs = CookingLog.objects.filter(user=request.auth).select_related("recipe").order_by("-cooked_at")
    results = []
    async for log in logs:
        results.append(
            CookingLogOut(
                id=log.id,
                recipe_id=log.recipe_id,
                recipe_title=log.recipe.title,
                recipe_image_url=log.recipe.image_url,
                cooked_at=log.cooked_at,
                rating=log.rating,
                notes=log.notes,
            )
        )
    return results


# ---------------------------------------------------------------------------
# Parameterized endpoints (/{recipe_id})
# ---------------------------------------------------------------------------


@router.get("/{recipe_id}", response={200: RecipeDetailOut, 404: ErrorOut, 502: ErrorOut})
async def get_recipe(request, recipe_id: str):
    """Get full recipe details by internal UUID or Spoonacular external_id.

    Decision: Cache-on-first-access — if the recipe isn't in our DB yet,
    it's fetched from Spoonacular and stored for future lookups.
    """
    user = request.auth
    recipe = await _resolve_recipe(recipe_id)

    is_saved = await SavedRecipe.objects.filter(user=user, recipe=recipe).aexists()

    return RecipeDetailOut(
        id=recipe.id,
        external_id=recipe.external_id,
        source=recipe.source,
        title=recipe.title,
        description=recipe.description,
        instructions=recipe.instructions,
        ingredients_json=recipe.ingredients_json,
        prep_time_minutes=recipe.prep_time_minutes,
        cook_time_minutes=recipe.cook_time_minutes,
        servings=recipe.servings,
        difficulty=recipe.difficulty,
        image_url=recipe.image_url,
        nutrition=recipe.nutrition,
        source_url=recipe.source_url,
        is_saved=is_saved,
        created_at=recipe.created_at,
        updated_at=recipe.updated_at,
    )


@router.post(
    "/{recipe_id}/save",
    response={201: SavedRecipeOut, 409: ErrorOut, 502: ErrorOut},
)
async def save_recipe(request, recipe_id: str, payload: SaveRecipeNotesIn | None = None):
    """Save a recipe to the user's collection.

    Caches the recipe in DB first if needed (via _resolve_recipe).
    Returns 409 if already saved.
    """
    user = request.auth
    recipe = await _resolve_recipe(recipe_id)

    try:
        saved = await SavedRecipe.objects.acreate(
            user=user,
            recipe=recipe,
            notes=payload.notes if payload else None,
        )
    except IntegrityError:
        raise HttpError(409, "Recipe already saved")

    logger.info("[save_recipe] user=%s recipe=%s", user.id, recipe.id)

    is_saved = True
    return 201, SavedRecipeOut(
        id=saved.id,
        recipe=RecipeDetailOut(
            id=recipe.id,
            external_id=recipe.external_id,
            source=recipe.source,
            title=recipe.title,
            description=recipe.description,
            instructions=recipe.instructions,
            ingredients_json=recipe.ingredients_json,
            prep_time_minutes=recipe.prep_time_minutes,
            cook_time_minutes=recipe.cook_time_minutes,
            servings=recipe.servings,
            difficulty=recipe.difficulty,
            image_url=recipe.image_url,
            nutrition=recipe.nutrition,
            source_url=recipe.source_url,
            is_saved=is_saved,
            created_at=recipe.created_at,
            updated_at=recipe.updated_at,
        ),
        notes=saved.notes,
        created_at=saved.created_at,
    )


@router.delete(
    "/{recipe_id}/save",
    response={204: None, 404: ErrorOut},
)
async def unsave_recipe(request, recipe_id: str):
    """Remove a recipe from the user's saved collection.

    Returns 404 if the recipe isn't saved.
    """
    user = request.auth

    # Resolve to get the Recipe object (don't fetch from Spoonacular if missing)
    recipe = await _resolve_recipe(recipe_id, fetch_if_missing=False)

    try:
        saved = await SavedRecipe.objects.aget(user=user, recipe=recipe)
    except SavedRecipe.DoesNotExist:
        raise HttpError(404, "Recipe not saved")

    logger.info("[unsave_recipe] user=%s recipe=%s", user.id, recipe.id)
    await saved.adelete()
    return 204, None


@router.post(
    "/{recipe_id}/cooked",
    response={201: CookingLogOut, 502: ErrorOut},
)
async def log_cooking(request, recipe_id: str, payload: CookingLogIn | None = None):
    """Log that the user cooked a recipe.

    Decision: No automatic pantry deduction — ingredient name matching is
    complex and deferred to a future iteration. Just logs the event.
    """
    user = request.auth
    recipe = await _resolve_recipe(recipe_id)

    log = await CookingLog.objects.acreate(
        user=user,
        recipe=recipe,
        rating=payload.rating if payload else None,
        notes=payload.notes if payload else None,
    )

    logger.info("[log_cooking] user=%s recipe=%s rating=%s", user.id, recipe.id, log.rating)

    return 201, CookingLogOut(
        id=log.id,
        recipe_id=recipe.id,
        recipe_title=recipe.title,
        recipe_image_url=recipe.image_url,
        cooked_at=log.cooked_at,
        rating=log.rating,
        notes=log.notes,
    )
