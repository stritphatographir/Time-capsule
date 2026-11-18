from datetime import datetime
from enum import Enum

from pydantic import ConfigDict, Field, model_validator

from app.schemas.base import CamelModel


class CapsuleStatus(str, Enum):
    sealed = "sealed"
    ready = "ready"  # Срок уже наступил, но письмо ещё никто не открыл.
    opened = "opened"


class Song(CamelModel):
    title: str = Field(min_length=1, max_length=200)
    artist: str = Field(min_length=1, max_length=200)
    preview_url: str | None = Field(default=None, max_length=1000)
    artwork: str | None = Field(default=None, max_length=1000)


class CapsuleCreate(CamelModel):
    title: str = Field(min_length=1, max_length=100)
    message: str = Field(min_length=1, max_length=5000)
    prediction: str | None = Field(default=None, min_length=1, max_length=240)
    open_at: datetime
    song: Song | None = None

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "title": "A letter to myself",
                "prediction": "I will be teaching art.",
                "message": "Dear me,\nI hope the project is finished.",
                "openAt": "2030-01-01T12:00:00Z",
                "song": {"title": "Here Comes the Sun", "artist": "The Beatles"},
            }
        }
    )


class CapsuleUpdate(CamelModel):
    """Частичное обновление (PATCH): передаются только изменяемые поля."""

    title: str | None = Field(default=None, min_length=1, max_length=100)
    message: str | None = Field(default=None, min_length=1, max_length=5000)
    prediction: str | None = Field(default=None, min_length=1, max_length=240)
    open_at: datetime | None = None
    song: Song | None = None  # В PATCH явный null убирает песню.

    @model_validator(mode="after")
    def check_fields(self):
        if not self.model_fields_set:
            raise ValueError("Send at least one field to update.")
        for name in ("title", "message", "open_at"):
            if name in self.model_fields_set and getattr(self, name) is None:
                raise ValueError(f"{name} cannot be null.")
        return self


class CapsuleOut(CamelModel):
    id: int
    title: str
    created_at: datetime
    prediction: str | None = Field(default=None, min_length=1, max_length=240)
    open_at: datetime
    opened_at: datetime | None = None
    status: CapsuleStatus
    reflection: str | None = None
    recipient_count: int
    message: str | None = None
    song: Song | None = None


class Reflection(CamelModel):
    text: str = Field(min_length=1, max_length=1500)


class SignedNote(CamelModel):
    signature: str = Field(min_length=1, max_length=80)
    text: str = Field(min_length=1, max_length=600)


class NoteCount(CamelModel):
    note_count: int


class CapsuleDetail(CapsuleOut):
    note_count: int
    notes: list[SignedNote]
