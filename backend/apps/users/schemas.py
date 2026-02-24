import uuid

from ninja import Schema


class UserOut(Schema):
    id: uuid.UUID
    email: str
    display_name: str
    dietary_prefs: list
    household_size: int


class UserUpdateIn(Schema):
    display_name: str | None = None
    dietary_prefs: list | None = None
    household_size: int | None = None
