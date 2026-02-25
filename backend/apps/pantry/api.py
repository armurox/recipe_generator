import logging
from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Count, Q
from ninja import Router
from ninja.errors import HttpError
from ninja.pagination import PageNumberPagination, paginate

from apps.core.schemas import ErrorOut
from apps.ingredients.models import IngredientCategory
from apps.pantry.models import PantryItem
from apps.pantry.schemas import (
    BulkDeleteIn,
    BulkDeleteOut,
    CategorySummaryOut,
    PantryItemCreateIn,
    PantryItemCreateOut,
    PantryItemOut,
    PantrySummaryOut,
    PantryItemUpdateIn,
    PantryItemUseIn,
)
from apps.pantry.services import calculate_expiry_date, get_or_create_ingredient

logger = logging.getLogger(__name__)

router = Router(tags=["pantry"])


async def _build_pantry_item_response(item: PantryItem) -> dict:
    """Build the response dict for PantryItemOut from a PantryItem with ingredient loaded.

    Fetches the ingredient category explicitly because Django's async ORM does not
    populate nested FK caches (ingredient.category) from select_related — accessing
    a nullable nested FK silently returns None instead of the cached object.
    """
    ingredient = item.ingredient
    category_name = None
    category_icon = None
    if ingredient.category_id:
        category = await IngredientCategory.objects.filter(id=ingredient.category_id).afirst()
        if category:
            category_name = category.name
            category_icon = category.icon
    return {
        "id": item.id,
        "ingredient": {
            "id": ingredient.id,
            "name": ingredient.name,
            "category_name": category_name,
            "category_icon": category_icon,
        },
        "quantity": item.quantity,
        "unit": item.unit,
        "added_date": item.added_date,
        "expiry_date": item.expiry_date,
        "source": item.source,
        "status": item.status,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
    }


# ---------------------------------------------------------------------------
# List / filter endpoints (defined BEFORE /{item_id} to avoid route conflicts)
# ---------------------------------------------------------------------------


@router.get("/", response=list[PantryItemOut])
@paginate(PageNumberPagination, page_size=20)
async def list_pantry_items(
    request,
    status: str | None = None,
    expiring_within: int | None = None,
    category: int | None = None,
    search: str | None = None,
):
    """List the authenticated user's pantry items with optional filters.

    Supports filtering by status, expiring_within (days), category ID,
    and search (case-insensitive ingredient name match).
    Items are ordered by expiry date (soonest first).
    """
    qs = PantryItem.objects.filter(user=request.auth).select_related("ingredient__category")

    if status:
        qs = qs.filter(status=status)
    if expiring_within is not None:
        cutoff = date.today() + timedelta(days=expiring_within)
        qs = qs.filter(expiry_date__isnull=False, expiry_date__lte=cutoff, status=PantryItem.Status.AVAILABLE)
    if category is not None:
        qs = qs.filter(ingredient__category_id=category)
    if search:
        qs = qs.filter(ingredient__name__icontains=search.strip())

    return qs


@router.get("/expiring", response=list[PantryItemOut])
async def expiring_items(
    request,
    days: int = 3,
):
    """Get pantry items expiring within N days (default 3).

    Unpaginated convenience endpoint for dashboard/notifications.
    Only returns available items with a set expiry date.
    """
    cutoff = date.today() + timedelta(days=days)
    # Decision: Fetch IDs first, then aget() individually. Nested select_related
    # (ingredient__category) doesn't populate the second-level FK cache in async
    # iteration, but aget() works correctly.
    item_ids = [
        item_id
        async for item_id in PantryItem.objects.filter(
            user=request.auth,
            status=PantryItem.Status.AVAILABLE,
            expiry_date__isnull=False,
            expiry_date__lte=cutoff,
        ).values_list("id", flat=True)
    ]
    result = []
    for item_id in item_ids:
        item = await PantryItem.objects.select_related("ingredient__category").aget(id=item_id)
        result.append(await _build_pantry_item_response(item))
    return result


@router.get("/summary", response=PantrySummaryOut)
async def pantry_summary(request):
    """Get category-level summary of pantry items for the dashboard.

    Groups items by ingredient category with conditional counts for each status.
    Items without a category are grouped as "Uncategorized".
    """
    user = request.auth
    expiring_cutoff = date.today() + timedelta(days=3)

    # Decision: Use values().annotate() with conditional Count for efficient
    # single-query aggregation instead of multiple queries per category.
    category_stats = [
        row
        async for row in PantryItem.objects.filter(user=user)
        .values("ingredient__category__id", "ingredient__category__name", "ingredient__category__icon")
        .annotate(
            available_count=Count("id", filter=Q(status=PantryItem.Status.AVAILABLE)),
            expired_count=Count("id", filter=Q(status=PantryItem.Status.EXPIRED)),
            used_up_count=Count("id", filter=Q(status=PantryItem.Status.USED_UP)),
            expiring_soon_count=Count(
                "id",
                filter=Q(
                    status=PantryItem.Status.AVAILABLE,
                    expiry_date__isnull=False,
                    expiry_date__lte=expiring_cutoff,
                ),
            ),
            total_count=Count("id"),
        )
    ]

    categories = []
    total_items = 0
    total_available = 0
    total_expired = 0
    total_expiring_soon = 0

    for row in category_stats:
        categories.append(
            CategorySummaryOut(
                category_id=row["ingredient__category__id"],
                category_name=row["ingredient__category__name"] or "Uncategorized",
                category_icon=row["ingredient__category__icon"],
                available_count=row["available_count"],
                expired_count=row["expired_count"],
                used_up_count=row["used_up_count"],
                expiring_soon_count=row["expiring_soon_count"],
                total_count=row["total_count"],
            )
        )
        total_items += row["total_count"]
        total_available += row["available_count"]
        total_expired += row["expired_count"]
        total_expiring_soon += row["expiring_soon_count"]

    return PantrySummaryOut(
        total_items=total_items,
        total_available=total_available,
        total_expired=total_expired,
        total_expiring_soon=total_expiring_soon,
        categories=categories,
    )


# ---------------------------------------------------------------------------
# Bulk operations
# ---------------------------------------------------------------------------


@router.post("/bulk-delete", response={200: BulkDeleteOut, 400: ErrorOut})
async def bulk_delete_pantry_items(request, payload: BulkDeleteIn):
    """Delete multiple pantry items in a single operation.

    Only deletes items owned by the authenticated user. Returns the count of
    items actually deleted (silently skips IDs that don't exist or belong to
    another user).
    """
    if not payload.ids:
        raise HttpError(400, "No item IDs provided")

    if len(payload.ids) > 100:
        raise HttpError(400, "Cannot delete more than 100 items at once")

    result = await PantryItem.objects.filter(id__in=payload.ids, user=request.auth).adelete()
    deleted_count = result[0]

    logger.info(
        "[bulk_delete_pantry_items] user=%s requested=%d deleted=%d",
        request.auth.id,
        len(payload.ids),
        deleted_count,
    )
    return {"deleted_count": deleted_count}


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------


@router.post("/", response={201: PantryItemCreateOut, 200: PantryItemCreateOut})
async def add_pantry_item(request, payload: PantryItemCreateIn):
    """Manually add an item to the pantry.

    If the user already has an 'available' pantry item for the same ingredient,
    quantities are added together (upsert) and returns 200.
    New items return 201.
    """
    user = request.auth
    logger.info("[add_pantry_item] user=%s ingredient=%s", user.id, payload.ingredient_name)

    ingredient = await get_or_create_ingredient(payload.ingredient_name, payload.category_hint, payload.unit)

    # Decision: Same upsert pattern as confirm_receipt to respect the unique constraint
    # on (user, ingredient) where status=available.
    try:
        existing = await PantryItem.objects.select_related("ingredient__category").aget(
            user=user,
            ingredient=ingredient,
            status=PantryItem.Status.AVAILABLE,
        )
        if payload.quantity and existing.quantity:
            existing.quantity += payload.quantity
        elif payload.quantity:
            existing.quantity = payload.quantity
        if payload.unit:
            existing.unit = payload.unit
        if payload.expiry_date:
            existing.expiry_date = payload.expiry_date
        await existing.asave()
        # Re-fetch with relations for response (arefresh_from_db doesn't load select_related)
        existing = await PantryItem.objects.select_related("ingredient__category").aget(id=existing.id)
        logger.info("[add_pantry_item] upserted item=%s for user=%s", existing.id, user.id)
        return 200, {"item": await _build_pantry_item_response(existing), "created": False}
    except PantryItem.DoesNotExist:
        pass

    expiry = payload.expiry_date or await calculate_expiry_date(ingredient)
    unit = payload.unit or ingredient.common_unit

    item = await PantryItem.objects.acreate(
        user=user,
        ingredient=ingredient,
        quantity=payload.quantity,
        unit=unit,
        expiry_date=expiry,
        source=PantryItem.Source.MANUAL,
    )
    # Load relations for response
    item = await PantryItem.objects.select_related("ingredient__category").aget(id=item.id)
    logger.info("[add_pantry_item] created item=%s for user=%s", item.id, user.id)
    return 201, {"item": await _build_pantry_item_response(item), "created": True}


# ---------------------------------------------------------------------------
# Item-specific endpoints (/{item_id})
# ---------------------------------------------------------------------------


@router.patch("/{item_id}", response={200: PantryItemOut, 400: ErrorOut, 404: ErrorOut})
async def update_pantry_item(request, item_id: str, payload: PantryItemUpdateIn):
    """Partially update a pantry item (quantity, unit, expiry_date, status).

    Only fields provided in the request body are updated.
    Returns 400 for invalid status values.
    """
    try:
        item = await PantryItem.objects.select_related("ingredient__category").aget(id=item_id, user=request.auth)
    except PantryItem.DoesNotExist:
        raise HttpError(404, "Pantry item not found")

    if payload.status is not None:
        valid_statuses = {s.value for s in PantryItem.Status}
        if payload.status not in valid_statuses:
            raise HttpError(400, f"Invalid status. Must be one of: {', '.join(valid_statuses)}")
        item.status = payload.status
    if payload.quantity is not None:
        item.quantity = payload.quantity
    if payload.unit is not None:
        item.unit = payload.unit
    if payload.expiry_date is not None:
        item.expiry_date = payload.expiry_date

    await item.asave()
    logger.info("[update_pantry_item] item=%s updated", item.id)
    return await _build_pantry_item_response(item)


@router.delete("/{item_id}", response={204: None, 404: ErrorOut})
async def delete_pantry_item(request, item_id: str):
    """Delete a pantry item.

    Returns 404 if the item doesn't exist or belongs to another user.
    """
    try:
        item = await PantryItem.objects.aget(id=item_id, user=request.auth)
    except PantryItem.DoesNotExist:
        raise HttpError(404, "Pantry item not found")

    logger.info("[delete_pantry_item] item=%s user=%s", item.id, request.auth.id)
    await item.adelete()
    return 204, None


@router.post("/{item_id}/use", response={200: PantryItemOut, 400: ErrorOut, 404: ErrorOut})
async def use_pantry_item(request, item_id: str, payload: PantryItemUseIn | None = None):
    """Mark a pantry item as partially or fully used.

    If no quantity is provided, or the item has no tracked quantity, marks as used_up.
    If quantity is provided, decrements and keeps available if remainder > 0.
    Rejects use of non-available items with 400.
    """
    try:
        item = await PantryItem.objects.select_related("ingredient__category").aget(id=item_id, user=request.auth)
    except PantryItem.DoesNotExist:
        raise HttpError(404, "Pantry item not found")

    if item.status != PantryItem.Status.AVAILABLE:
        raise HttpError(400, f"Cannot use item with status '{item.status}'")

    use_quantity = payload.quantity if payload else None

    if use_quantity is None or item.quantity is None:
        # Use all — mark as used_up
        item.status = PantryItem.Status.USED_UP
        if item.quantity is not None:
            item.quantity = Decimal("0")
        logger.info("[use_pantry_item] item=%s fully used", item.id)
    else:
        if use_quantity > item.quantity:
            raise HttpError(400, "Cannot use more than available quantity")
        item.quantity -= use_quantity
        if item.quantity <= 0:
            item.status = PantryItem.Status.USED_UP
            item.quantity = Decimal("0")
            logger.info("[use_pantry_item] item=%s fully used (exact quantity)", item.id)
        else:
            logger.info("[use_pantry_item] item=%s partially used, remaining=%s", item.id, item.quantity)

    await item.asave()
    return await _build_pantry_item_response(item)
