import logging
from decimal import Decimal

from django.db.models import Count
from ninja import Router
from ninja.errors import HttpError
from ninja.pagination import PageNumberPagination, paginate

from apps.core.schemas import ErrorOut
from apps.pantry.api import _build_pantry_item_response
from apps.pantry.models import PantryItem
from apps.pantry.services import calculate_expiry_date, get_or_create_ingredient
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

logger = logging.getLogger(__name__)

router = Router(tags=["receipts"])

# Decision: Module-level provider instance so it can be easily patched in tests.
ocr_provider = ClaudeOCRProvider()


@router.post("/scan", response={200: ReceiptScanDetailOut, 400: ErrorOut, 502: ErrorOut})
async def scan_receipt(request, payload: ScanReceiptIn):
    """Upload a receipt image URL for OCR extraction.

    Creates a ReceiptScan record, calls Claude Vision to extract line items,
    creates ReceiptItem records for each extracted line, and returns the scan
    with all items for user review before confirming to pantry.

    Returns 502 if the OCR provider fails (API error, image download failure).
    """
    user = request.auth
    logger.info("[scan_receipt] user=%s image_url=%s", user.id, payload.image_url)

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
    response={200: ConfirmReceiptOut, 400: ErrorOut, 404: ErrorOut},
)
async def confirm_receipt(request, scan_id: str, payload: ConfirmReceiptIn):
    """Confirm extracted items and add them to the user's pantry.

    Only items included in the request are added. Users can override
    ingredient_name, quantity, unit, and expiry_date to correct OCR mistakes
    or set custom expiry dates.

    If the user already has an 'available' pantry item for the same ingredient,
    quantities are added together (upsert) instead of creating a duplicate.

    Returns the created/updated pantry items with full ingredient detail.
    """
    try:
        scan = await ReceiptScan.objects.aget(id=scan_id, user=request.auth)
    except ReceiptScan.DoesNotExist:
        raise HttpError(404, "Scan not found")

    if scan.status != ReceiptScan.Status.COMPLETED:
        raise HttpError(400, "Can only confirm completed scans")

    logger.info("[confirm_receipt] scan=%s, confirming %d items", scan.id, len(payload.items))

    # Decision: Pre-fetch all receipt items for this scan in one query
    # to validate IDs and avoid N+1 lookups in the confirm loop.
    scan_items = {item.id: item async for item in ReceiptItem.objects.filter(receipt=scan).select_related("ingredient")}

    created_count = 0
    updated_count = 0
    pantry_item_ids = []

    for confirm_item in payload.items:
        receipt_item = scan_items.get(confirm_item.receipt_item_id)
        if not receipt_item:
            raise HttpError(400, f"Item {confirm_item.receipt_item_id} not found in this scan")

        # Resolve ingredient: use override name if provided, otherwise existing
        ingredient_name = confirm_item.ingredient_name
        if not ingredient_name and receipt_item.ingredient:
            ingredient_name = receipt_item.ingredient.name
        if not ingredient_name:
            raise HttpError(400, f"No ingredient name for item {confirm_item.receipt_item_id}")

        ingredient = await get_or_create_ingredient(ingredient_name, None, None)

        quantity = confirm_item.quantity if confirm_item.quantity is not None else receipt_item.quantity
        unit = confirm_item.unit if confirm_item.unit is not None else receipt_item.unit

        # Decision: User-provided expiry_date takes precedence over auto-calculation.
        expiry_date = confirm_item.expiry_date or await calculate_expiry_date(ingredient)

        # Decision: Upsert — if an "available" pantry item exists for this ingredient,
        # add the quantity rather than creating a duplicate (respects UniqueConstraint).
        try:
            existing = await PantryItem.objects.aget(
                user=request.auth,
                ingredient=ingredient,
                status=PantryItem.Status.AVAILABLE,
            )
            if quantity and existing.quantity:
                existing.quantity += quantity
            elif quantity:
                existing.quantity = quantity
            if confirm_item.expiry_date:
                existing.expiry_date = confirm_item.expiry_date
            existing.receipt_scan = scan
            await existing.asave()
            updated_count += 1
            pantry_item_ids.append(existing.id)
        except PantryItem.DoesNotExist:
            pantry_item = await PantryItem.objects.acreate(
                user=request.auth,
                ingredient=ingredient,
                quantity=quantity,
                unit=unit or ingredient.common_unit,
                expiry_date=expiry_date,
                source=PantryItem.Source.RECEIPT_SCAN,
                receipt_scan=scan,
            )
            created_count += 1
            pantry_item_ids.append(pantry_item.id)

    # Batch-fetch all created/updated items with relations for the response
    pantry_items = [
        _build_pantry_item_response(item)
        async for item in PantryItem.objects.filter(id__in=pantry_item_ids).select_related("ingredient__category")
    ]

    logger.info("[confirm_receipt] scan=%s done: created=%d, updated=%d", scan.id, created_count, updated_count)
    return {
        "pantry_items_created": created_count,
        "pantry_items_updated": updated_count,
        "items": pantry_items,
    }


@router.delete("/{scan_id}", response={204: None, 404: ErrorOut})
async def delete_scan(request, scan_id: str):
    """Delete a receipt scan and all its items (cascade).

    Returns 404 if the scan doesn't exist or belongs to another user.
    """
    try:
        scan = await ReceiptScan.objects.aget(id=scan_id, user=request.auth)
    except ReceiptScan.DoesNotExist:
        raise HttpError(404, "Scan not found")

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
