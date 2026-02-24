import base64
import logging
import mimetypes

import anthropic
import httpx
from django.conf import settings

from apps.receipts.services.base import (
    ExtractedItem,
    OCRExtractionError,
    OCRProvider,
    ReceiptExtractionResult,
)

logger = logging.getLogger(__name__)

# Category names from seed_categories management command — used as hints for Claude
CATEGORY_NAMES = [
    "Fresh Vegetables",
    "Fresh Fruits",
    "Leafy Greens",
    "Root Vegetables",
    "Herbs",
    "Dairy",
    "Cheese",
    "Eggs",
    "Meat",
    "Poultry",
    "Seafood",
    "Deli Meats",
    "Bread & Bakery",
    "Canned Goods",
    "Frozen Foods",
    "Dry Goods & Pasta",
    "Rice & Grains",
    "Snacks",
    "Condiments & Sauces",
    "Oils & Vinegars",
    "Spices & Seasonings",
    "Beverages",
    "Baking Supplies",
    "Nuts & Seeds",
    "Tofu & Plant Protein",
]

EXTRACT_TOOL = {
    "name": "extract_receipt_items",
    "description": "Extract structured line items from a grocery receipt image.",
    "input_schema": {
        "type": "object",
        "properties": {
            "store_name": {
                "type": ["string", "null"],
                "description": "Name of the store, or null if not visible.",
            },
            "items": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "raw_text": {
                            "type": "string",
                            "description": "Exact text as printed on the receipt line.",
                        },
                        "name": {
                            "type": "string",
                            "description": (
                                "Normalized, human-readable ingredient name in lowercase. "
                                "E.g. 'ORGANIC BNLS CHKN BRST' → 'chicken breast'."
                            ),
                        },
                        "quantity": {
                            "type": ["number", "null"],
                            "description": "Numeric quantity purchased. Null if not clear.",
                        },
                        "unit": {
                            "type": ["string", "null"],
                            "description": (
                                "Unit of measurement (e.g. 'kg', 'lb', 'oz', 'piece', 'bunch'). Null if not specified."
                            ),
                        },
                        "price": {
                            "type": ["number", "null"],
                            "description": "Price for this line item. Null if not visible.",
                        },
                        "is_food": {
                            "type": "boolean",
                            "description": (
                                "True for food/grocery items. False for non-food lines like "
                                "TAX, BAGS, SUBTOTAL, TOTAL, CHANGE, CARD, DISCOUNT, etc."
                            ),
                        },
                        "category_hint": {
                            "type": ["string", "null"],
                            "description": ("Best-matching category from the provided list, or null."),
                        },
                    },
                    "required": ["raw_text", "name", "is_food"],
                },
            },
        },
        "required": ["store_name", "items"],
    },
}

SYSTEM_PROMPT = f"""You are a grocery receipt OCR specialist. Extract every line item from the receipt image.

Rules:
1. **Normalize names**: Convert abbreviated/uppercase receipt text to clean, lowercase ingredient names.
   Examples: "ORGANIC BNLS CHKN BRST" → "chicken breast", "GRN PEPPERS" → "green pepper", "2% MILK 1GAL" → "milk"
2. **Non-food items**: Set is_food=false for TAX, BAGS, SUBTOTAL, TOTAL, CHANGE, CARD PAYMENT, DISCOUNT, COUPON, DEPOSIT, and similar non-grocery lines.
3. **Quantities**: Extract numeric quantities when visible (e.g. "2 @ $1.99" → quantity=2). Default to 1 for single items.
4. **Units**: Detect units from context (kg, lb, oz, g, L, gal, piece, bunch, pack, can, bottle, box, bag).
5. **Prices**: Extract the price for each line item if visible.
6. **Category hints**: Assign the best-matching category from this list:
   {", ".join(CATEGORY_NAMES)}
7. **Include everything**: Extract ALL visible line items, including non-food ones.
8. **Be precise**: If you cannot determine a field, use null rather than guessing."""

MEDIA_TYPE_MAP = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
}


class ClaudeOCRProvider(OCRProvider):
    def __init__(self):
        self.client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
        self.model = settings.ANTHROPIC_MODEL

    async def extract_receipt(self, image_url: str) -> ReceiptExtractionResult:
        """Download receipt image, send to Claude Vision, return structured extraction."""
        image_data, media_type = await self._download_image(image_url)

        try:
            response = await self.client.messages.create(
                model=self.model,
                max_tokens=4096,
                system=SYSTEM_PROMPT,
                tools=[EXTRACT_TOOL],
                tool_choice={"type": "tool", "name": "extract_receipt_items"},
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": media_type,
                                    "data": image_data,
                                },
                            },
                            {
                                "type": "text",
                                "text": "Extract all line items from this grocery receipt.",
                            },
                        ],
                    }
                ],
            )
        except anthropic.APIError as exc:
            logger.error("Claude API error: %s", exc)
            raise OCRExtractionError(f"Claude API error: {exc}") from exc

        return self._parse_response(response)

    async def _download_image(self, image_url: str) -> tuple[str, str]:
        """Download image from URL, return (base64_data, media_type)."""
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.get(image_url)
                resp.raise_for_status()
        except httpx.HTTPError as exc:
            raise OCRExtractionError(f"Failed to download image: {exc}") from exc

        content_type = resp.headers.get("content-type", "")
        if content_type and "/" in content_type:
            media_type = content_type.split(";")[0].strip()
        else:
            # Guess from URL extension
            ext = "." + image_url.rsplit(".", 1)[-1].split("?")[0].lower() if "." in image_url else ""
            media_type = MEDIA_TYPE_MAP.get(ext) or mimetypes.guess_type(image_url)[0] or "image/jpeg"

        image_data = base64.b64encode(resp.content).decode("utf-8")
        return image_data, media_type

    def _parse_response(self, response) -> ReceiptExtractionResult:
        """Extract tool_use block from Claude response and map to dataclass."""
        raw_response = response.model_dump()

        for block in response.content:
            if block.type == "tool_use" and block.name == "extract_receipt_items":
                tool_input = block.input
                items = [
                    ExtractedItem(
                        raw_text=item["raw_text"],
                        name=item["name"],
                        quantity=item.get("quantity"),
                        unit=item.get("unit"),
                        price=item.get("price"),
                        is_food=item.get("is_food", True),
                        category_hint=item.get("category_hint"),
                    )
                    for item in tool_input.get("items", [])
                ]
                return ReceiptExtractionResult(
                    store_name=tool_input.get("store_name"),
                    items=items,
                    raw_response=raw_response,
                )

        raise OCRExtractionError("No tool_use block found in Claude response")
