import logging
from datetime import date, timedelta
from decimal import Decimal

from django.conf import settings
from django.db.models import Count
from ninja import Router
from ninja.errors import HttpError
from ninja.pagination import PageNumberPagination, paginate

from apps.core.ratelimit import check_rate_limit
from apps.core.schemas import ErrorOut
from apps.ingredients.models import Ingredient, IngredientCategory
from apps.pantry.models import PantryItem
from apps.pantry.services import get_or_create_ingredient
from apps.receipts.models import ReceiptItem, ReceiptScan
from apps.receipts.schemas import (
    ConfirmReceiptIn,
    ConfirmReceiptOut,
    ReceiptScanDetailOut,
    ReceiptScanOut,
    ScanReceiptIn,
)
from apps.receipts.services.base import OCRExtractionError
from apps.receipts.services.claude_ocr import ClaudeOCRProvider
from apps.receipts.validators import validate_image_url

logger = logging.getLogger(__name__)

router = Router(tags=["receipts"])

# Decision: Module-level provider instance so it can be easily patched in tests.
ocr_provider = ClaudeOCRProvider()


@router.post("/scan", response={200: ReceiptScanDetailOut, 400: ErrorOut, 429: ErrorOut, 502: ErrorOut})
async def scan_receipt(request, payload: ScanReceiptIn):
    """Upload a receipt image URL for OCR extraction.

    Creates a ReceiptScan record, calls Claude Vision to extract line items,
    creates ReceiptItem records for each extracted line, and returns the scan
    with all items for user review before confirming to pantry.

    Rate limited to SCAN_RATE_LIMIT_MAX scans per SCAN_RATE_LIMIT_PERIOD
    (default: 10/hour) per user to control Claude Vision API costs.

    Returns 400 if the image URL is not from Supabase Storage (SSRF protection).
    Returns 429 if the rate limit is exceeded.
    Returns 502 if the OCR provider fails (API error, image download failure).
    """
    user = request.auth
    logger.info("[scan_receipt] user=%s image_url=%s", user.id, payload.image_url)

    # SSRF protection: only allow Supabase Storage URLs
    validate_image_url(payload.image_url)

    # Rate limit: prevent excessive Claude Vision API calls
    check_rate_limit(
        f"scan:{user.id}",
        max_calls=settings.SCAN_RATE_LIMIT_MAX,
        period=settings.SCAN_RATE_LIMIT_PERIOD,
    )

    scan = await ReceiptScan.objects.acreate(
        user=user,
        image_url=payload.image_url,
    )
    logger.info("[scan_receipt] created scan=%s", scan.id)

    try:
        result = await ocr_provider.extract_receipt(payload.image_url)
    except OCRExtractionError as exc:
        scan.status = ReceiptScan.Status.FAILED
        await scan.asave()
        logger.exception("[scan_receipt] OCR failed for scan=%s", scan.id)
        raise HttpError(502, f"Receipt extraction failed: {exc}")

    scan.store_name = result.store_name
    scan.raw_extraction = result.raw_response
    scan.status = ReceiptScan.Status.COMPLETED
    await scan.asave()

    items = []
    for extracted in result.items:
        ingredient = None
        if extracted.is_food:
            ingredient = await get_or_create_ingredient(extracted.name, extracted.category_hint, extracted.unit)

        item = await ReceiptItem.objects.acreate(
            receipt=scan,
            ingredient=ingredient,
            raw_text=extracted.raw_text,
            quantity=Decimal(str(extracted.quantity)) if extracted.quantity is not None else None,
            unit=extracted.unit,
            price=Decimal(str(extracted.price)) if extracted.price is not None else None,
        )
        items.append(item)

    logger.info("[scan_receipt] scan=%s completed, %d items created", scan.id, len(items))
    return _build_scan_detail_response(scan, items)


@router.get("/", response=list[ReceiptScanOut])
@paginate(PageNumberPagination, page_size=20)
async def list_scans(request):
    """List the authenticated user's receipt scans, newest first.

    Annotated with item_count for summary display without loading all items.
    """
    return ReceiptScan.objects.filter(user=request.auth).annotate(item_count=Count("items")).order_by("-scanned_at")


@router.get("/{scan_id}", response={200: ReceiptScanDetailOut, 404: ErrorOut})
async def get_scan(request, scan_id: str):
    """Get a receipt scan with all extracted line items.

    Prefetches items and their linked ingredients to avoid N+1 queries.
    Returns 404 if the scan doesn't exist or belongs to another user.
    """
    try:
        scan = await ReceiptScan.objects.prefetch_related("items__ingredient").aget(id=scan_id, user=request.auth)
    except ReceiptScan.DoesNotExist:
        raise HttpError(404, "Scan not found")

    items = [item async for item in scan.items.all()]
    return _build_scan_detail_response(scan, items)


@router.post(
    "/{scan_id}/confirm",
    response={200: ConfirmReceiptOut, 400: ErrorOut, 404: ErrorOut, 409: ErrorOut},
)
async def confirm_receipt(request, scan_id: str, payload: ConfirmReceiptIn):
    """Confirm extracted items and add them to the user's pantry.

    Only items included in the request are added. Users can override
    ingredient_name, quantity, unit, and expiry_date to correct OCR mistakes
    or set custom expiry dates.

    If the user already has an 'available' pantry item for the same ingredient,
    quantities are added together (upsert) instead of creating a duplicate.

    Returns 409 if the scan has already been confirmed.

    Optimized for bulk operations: batches DB queries to minimize round-trips
    to the remote database (5-6 queries total instead of ~6 per item).
    """
    try:
        scan = await ReceiptScan.objects.aget(id=scan_id, user=request.auth)
    except ReceiptScan.DoesNotExist:
        raise HttpError(404, "Scan not found")

    if scan.status == ReceiptScan.Status.CONFIRMED:
        raise HttpError(409, "Scan has already been confirmed")
    if scan.status != ReceiptScan.Status.COMPLETED:
        raise HttpError(400, "Can only confirm completed scans")

    logger.info("[confirm_receipt] scan=%s, confirming %d items", scan.id, len(payload.items))

    # 1. Pre-fetch all receipt items for this scan in one query
    scan_items = {item.id: item async for item in ReceiptItem.objects.filter(receipt=scan).select_related("ingredient")}

    # 2. Resolve ingredient names for all items, validate early
    resolved_names: list[str] = []
    for confirm_item in payload.items:
        receipt_item = scan_items.get(confirm_item.receipt_item_id)
        if not receipt_item:
            raise HttpError(400, f"Item {confirm_item.receipt_item_id} not found in this scan")
        name = confirm_item.ingredient_name
        if not name and receipt_item.ingredient:
            name = receipt_item.ingredient.name
        if not name:
            raise HttpError(400, f"No ingredient name for item {confirm_item.receipt_item_id}")
        resolved_names.append(name.lower().strip())

    # 3. Batch-fetch existing ingredients by name (1 query)
    existing_ingredients = {ing.name: ing async for ing in Ingredient.objects.filter(name__in=resolved_names)}

    # Create missing ingredients in bulk (1 query)
    missing_names = [n for n in resolved_names if n not in existing_ingredients]
    if missing_names:
        # Use aget_or_create per missing name to handle races, but this is
        # only for the subset that doesn't exist (usually small or zero)
        for name in set(missing_names):
            ing, _ = await Ingredient.objects.aget_or_create(name=name)
            existing_ingredients[name] = ing

    # 4. Batch-fetch all categories for expiry calculation (1 query)
    category_ids = {ing.category_id for ing in existing_ingredients.values() if ing.category_id}
    categories = {}
    if category_ids:
        categories = {cat.id: cat async for cat in IngredientCategory.objects.filter(id__in=category_ids)}

    # 5. Batch-fetch existing pantry items for upsert check (1 query)
    ingredient_ids = [existing_ingredients[n].id for n in resolved_names]
    existing_pantry = {}
    async for pi in PantryItem.objects.filter(
        user=request.auth,
        ingredient_id__in=ingredient_ids,
        status=PantryItem.Status.AVAILABLE,
    ):
        existing_pantry[pi.ingredient_id] = pi

    # 6. Process all items: batch updates and creates
    created_count = 0
    updated_count = 0
    to_update: list[PantryItem] = []
    to_create: list[PantryItem] = []

    for i, confirm_item in enumerate(payload.items):
        receipt_item = scan_items[confirm_item.receipt_item_id]
        ingredient = existing_ingredients[resolved_names[i]]
        quantity = confirm_item.quantity if confirm_item.quantity is not None else receipt_item.quantity
        unit = confirm_item.unit if confirm_item.unit is not None else receipt_item.unit

        # Expiry: user override > category shelf life > None
        if confirm_item.expiry_date:
            expiry_date = confirm_item.expiry_date
        elif ingredient.category_id and ingredient.category_id in categories:
            expiry_date = date.today() + timedelta(days=categories[ingredient.category_id].default_shelf_life)
        else:
            expiry_date = None

        existing = existing_pantry.get(ingredient.id)
        if existing:
            if quantity and existing.quantity:
                existing.quantity += quantity
            elif quantity:
                existing.quantity = quantity
            if confirm_item.expiry_date:
                existing.expiry_date = confirm_item.expiry_date
            existing.receipt_scan = scan
            to_update.append(existing)
            updated_count += 1
        else:
            pantry_item = PantryItem(
                user=request.auth,
                ingredient=ingredient,
                quantity=quantity,
                unit=unit or ingredient.common_unit,
                expiry_date=expiry_date,
                source=PantryItem.Source.RECEIPT_SCAN,
                receipt_scan=scan,
            )
            to_create.append(pantry_item)
            # Track in existing_pantry so duplicate ingredients in same receipt upsert
            existing_pantry[ingredient.id] = pantry_item
            created_count += 1

    # Bulk write (2 queries max)
    if to_update:
        await PantryItem.objects.abulk_update(to_update, ["quantity", "expiry_date", "receipt_scan"])
    if to_create:
        await PantryItem.objects.abulk_create(to_create)

    # 7. Batch-fetch all result items with relations (1 query + 1 for categories)
    all_ids = [pi.id for pi in to_update] + [pi.id for pi in to_create]
    result_items = []
    async for item in PantryItem.objects.filter(id__in=all_ids).select_related("ingredient"):
        result_items.append(item)

    # Batch-fetch categories for response (reuse already-fetched categories)
    pantry_items = []
    for item in result_items:
        cat = categories.get(item.ingredient.category_id) if item.ingredient.category_id else None
        pantry_items.append(
            {
                "id": item.id,
                "ingredient": {
                    "id": item.ingredient.id,
                    "name": item.ingredient.name,
                    "category_name": cat.name if cat else None,
                    "category_icon": cat.icon if cat else None,
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
        )

    # Mark scan as confirmed so it cannot be confirmed or deleted again
    scan.status = ReceiptScan.Status.CONFIRMED
    await scan.asave()

    logger.info("[confirm_receipt] scan=%s done: created=%d, updated=%d", scan.id, created_count, updated_count)
    return {
        "pantry_items_created": created_count,
        "pantry_items_updated": updated_count,
        "items": pantry_items,
    }


@router.delete("/{scan_id}", response={204: None, 404: ErrorOut, 409: ErrorOut})
async def delete_scan(request, scan_id: str):
    """Delete a receipt scan and all its items (cascade).

    Returns 404 if the scan doesn't exist or belongs to another user.
    Returns 409 if the scan has already been confirmed (items added to pantry).
    """
    try:
        scan = await ReceiptScan.objects.aget(id=scan_id, user=request.auth)
    except ReceiptScan.DoesNotExist:
        raise HttpError(404, "Scan not found")

    if scan.status == ReceiptScan.Status.CONFIRMED:
        raise HttpError(409, "Cannot delete a confirmed scan")

    logger.info("[delete_scan] scan=%s user=%s", scan.id, request.auth.id)
    await scan.adelete()
    return 204, None


def _build_scan_detail_response(scan: ReceiptScan, items: list[ReceiptItem]) -> dict:
    """Build the response dict for ReceiptScanDetailOut."""
    return {
        "id": scan.id,
        "image_url": scan.image_url,
        "store_name": scan.store_name,
        "scanned_at": scan.scanned_at,
        "status": scan.status,
        "items": [
            {
                "id": item.id,
                "raw_text": item.raw_text,
                "ingredient_id": item.ingredient_id,
                "ingredient_name": item.ingredient.name if item.ingredient else None,
                "quantity": item.quantity,
                "unit": item.unit,
                "price": item.price,
                "is_food": item.ingredient_id is not None,
            }
            for item in items
        ],
    }
