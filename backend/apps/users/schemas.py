import uuid

from ninja import Field, Schema


class UserOut(Schema):
    id: uuid.UUID
    email: str
    display_name: str
    dietary_prefs: list = Field(description="List of dietary preferences (e.g. 'vegetarian', 'gluten-free')")
    household_size: int = Field(description="Number of people in the household, used for recipe scaling")


class UserUpdateIn(Schema):
    display_name: str | None = None
    dietary_prefs: list | None = Field(
        default=None, description="List of dietary preferences (e.g. 'vegetarian', 'gluten-free')"
    )
    household_size: int | None = Field(
        default=None, description="Number of people in the household, used for recipe scaling"
    )
