import uuid
from datetime import date, datetime
from decimal import Decimal

from ninja import Field, Schema

from apps.pantry.schemas import PantryItemOut


class ScanReceiptIn(Schema):
    image_url: str = Field(description="Supabase Storage URL of the uploaded receipt image")


class ReceiptItemOut(Schema):
    id: int
    raw_text: str = Field(description="Original text as printed on the receipt")
    ingredient_id: int | None = Field(default=None, description="Linked ingredient ID, null for non-food items")
    ingredient_name: str | None = Field(default=None, description="Normalized ingredient name")
    quantity: Decimal | None = None
    unit: str | None = None
    price: Decimal | None = None
    is_food: bool = Field(description="False for non-food lines like TAX, BAGS, SUBTOTAL")


class ReceiptScanOut(Schema):
    id: uuid.UUID
    image_url: str
    store_name: str | None = None
    scanned_at: datetime
    status: str
    item_count: int = Field(description="Number of line items extracted from this receipt")


class ReceiptScanDetailOut(Schema):
    id: uuid.UUID
    image_url: str
    store_name: str | None = None
    scanned_at: datetime
    status: str
    items: list[ReceiptItemOut]


class ConfirmItemIn(Schema):
    receipt_item_id: int
    ingredient_name: str | None = Field(default=None, description="Override the OCR-detected ingredient name")
    quantity: Decimal | None = Field(default=None, description="Override the OCR-detected quantity")
    unit: str | None = Field(default=None, description="Override the OCR-detected unit")
    expiry_date: date | None = Field(default=None, description="Override the auto-calculated expiry date")


class ConfirmReceiptIn(Schema):
    items: list[ConfirmItemIn] = Field(description="Items to confirm and add to pantry")


class ConfirmReceiptOut(Schema):
    pantry_items_created: int
    pantry_items_updated: int
    items: list[PantryItemOut] = Field(description="The created/updated pantry items with full detail")
