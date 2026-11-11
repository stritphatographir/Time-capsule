from datetime import datetime
from enum import Enum

from pydantic import ConfigDict, Field, model_validator

from app.schemas.base import CamelModel


class CapsuleStatus(str, Enum):
    sealed = "sealed"      # The opening date has not arrived yet
    ready = "ready"    # The date has arrived, but the seal is still intact
    opened = "opened"  # The seal is broken, and the letter is accessible


class Song(CamelModel):
    title: str = Field(min_length=1, max_length=200)
    artist: str = Field(min_length=1, max_length=200)
    preview_url: str | None = Field(default=None, max_length=1000)
    artwork: str | None = Field(default=None, max_length=1000)


class CapsuleCreate(CamelModel):
    title: str = Field(min_length=1, max_length=100)
    message: str = Field(min_length=1, max_length=5000)
    open_at: datetime
    song: Song | None = None

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "title": "A letter to myself",
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
    open_at: datetime | None = None
    song: Song | None = None  # Explicit null removes the song

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
    open_at: datetime
    opened_at: datetime | None = None
    status: CapsuleStatus
    recipient_count: int
    # The server returns message and song only when the seal is broken (status = opened)
    message: str | None = None
    song: Song | None = None
