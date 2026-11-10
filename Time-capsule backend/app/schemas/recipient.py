from datetime import datetime

from pydantic import ConfigDict, Field, field_validator

from app.schemas.base import CamelModel

EMAIL_PATTERN = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"


class RecipientCreate(CamelModel):
    email: str = Field(max_length=254, pattern=EMAIL_PATTERN)
    name: str | None = Field(default=None, max_length=100)

    model_config = ConfigDict(
        json_schema_extra={"example": {"email": "friend@example.com", "name": "Aigerim"}}
    )

    @field_validator("email")
    @classmethod
    def lowercase_email(cls, value: str) -> str:
        return value.lower()

    @field_validator("name")
    @classmethod
    def empty_name_is_none(cls, value: str | None) -> str | None:
        return value or None


class RecipientOut(CamelModel):
    id: int
    capsule_id: int
    email: str
    name: str | None = None
    added_at: datetime
