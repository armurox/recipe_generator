import uuid

from ninja import Field, Schema
from pydantic import field_validator

# Spoonacular-supported diet values — used for dietary_prefs validation
VALID_DIETARY_PREFS = frozenset(
    {
        "vegetarian",
        "vegan",
        "gluten free",
        "ketogenic",
        "paleo",
        "whole30",
        "primal",
        "lacto-vegetarian",
        "ovo-vegetarian",
        "pescetarian",
    }
)


class UserOut(Schema):
    id: uuid.UUID
    email: str
    display_name: str
    dietary_prefs: list[str] = Field(description="List of dietary preferences (e.g. 'vegetarian', 'gluten free')")
    household_size: int = Field(description="Number of people in the household, used for recipe scaling")


class UserUpdateIn(Schema):
    display_name: str | None = None
    dietary_prefs: list[str] | None = Field(
        default=None, description="List of dietary preferences (e.g. 'vegetarian', 'gluten free')"
    )
    household_size: int | None = Field(
        default=None, description="Number of people in the household, used for recipe scaling"
    )

    @field_validator("dietary_prefs")
    @classmethod
    def validate_dietary_prefs(cls, v: list[str] | None) -> list[str] | None:
        if v is None:
            return v
        invalid = [p for p in v if p not in VALID_DIETARY_PREFS]
        if invalid:
            allowed = ", ".join(sorted(VALID_DIETARY_PREFS))
            raise ValueError(f"Invalid dietary preferences: {', '.join(invalid)}. Allowed values: {allowed}")
        return v
