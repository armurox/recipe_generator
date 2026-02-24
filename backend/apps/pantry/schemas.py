import uuid
from datetime import date, datetime
from decimal import Decimal

from ninja import Field, Schema


class IngredientOut(Schema):
    id: int
    name: str
    category_name: str | None = Field(default=None, description="Ingredient category name")
    category_icon: str | None = Field(default=None, description="Emoji icon for the category")

    @staticmethod
    def resolve_category_name(obj):
        return obj.category.name if obj.category else None

    @staticmethod
    def resolve_category_icon(obj):
        return obj.category.icon if obj.category else None


class PantryItemOut(Schema):
    id: uuid.UUID
    ingredient: IngredientOut
    quantity: Decimal | None = None
    unit: str | None = None
    added_date: date
    expiry_date: date | None = None
    source: str
    status: str
    created_at: datetime
    updated_at: datetime


class PantryItemCreateIn(Schema):
    ingredient_name: str = Field(description="Name of the ingredient to add")
    quantity: Decimal | None = Field(default=None, description="Quantity of the item")
    unit: str | None = Field(default=None, description="Unit of measurement")
    expiry_date: date | None = Field(default=None, description="Override auto-calculated expiry date")
    category_hint: str | None = Field(default=None, description="Category name hint for new ingredients")


class PantryItemCreateOut(Schema):
    item: PantryItemOut
    created: bool = Field(description="True if a new item was created, False if an existing item was updated")


class PantryItemUpdateIn(Schema):
    quantity: Decimal | None = None
    unit: str | None = None
    expiry_date: date | None = None
    status: str | None = Field(default=None, description="One of: available, expired, used_up")


class PantryItemUseIn(Schema):
    quantity: Decimal | None = Field(default=None, description="Quantity to consume; omit to use all")


class CategorySummaryOut(Schema):
    category_id: int | None = None
    category_name: str
    category_icon: str | None = None
    available_count: int
    expired_count: int
    used_up_count: int
    expiring_soon_count: int
    total_count: int


class PantrySummaryOut(Schema):
    total_items: int
    total_available: int
    total_expired: int
    total_expiring_soon: int
    categories: list[CategorySummaryOut]
