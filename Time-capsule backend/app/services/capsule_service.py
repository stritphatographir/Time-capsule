"""Capsule business logic. No HTTP-related code here, only rules and data."""
import os
from datetime import datetime, timedelta, timezone
from typing import Any

from app import storage
from app.exceptions import (
    AlreadyOpenedError,
    CapsuleLockedError,
    CapsuleNotEditableError,
    CapsuleNotFoundError,
    InvalidOpenDateError,
)
from app.schemas.capsule import CapsuleCreate, CapsuleStatus, CapsuleUpdate
# Minimum lead time before opening. Can be reduced for demonstration:
#   CAPSULE_MIN_LEAD_SECONDS=5 uvicorn app.main:app --reload
MIN_LEAD = timedelta(seconds=int(os.getenv("CAPSULE_MIN_LEAD_SECONDS", "60")))
MAX_LEAD = timedelta(days=365 * 50)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(value: datetime) -> datetime:
    """A date without a timezone is treated as UTC."""
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _check_open_at(open_at: datetime) -> None:
    now = utcnow()
    if open_at < now + MIN_LEAD:
        seconds = int(MIN_LEAD.total_seconds())
        raise InvalidOpenDateError(f"The opening date must be at least {seconds} seconds from now.")
    if open_at > now + MAX_LEAD:
        raise InvalidOpenDateError("Choose a date within the next 50 years.")


def get_status(record: dict[str, Any]) -> CapsuleStatus:
    if record["opened_at"] is not None:
        return CapsuleStatus.opened
    if utcnow() >= record["open_at"]:
        return CapsuleStatus.ready
    return CapsuleStatus.sealed


def to_public(record: dict[str, Any]) -> dict[str, Any]:
    """Server-side «lock» (similar to applyLock in api.js).

    The letter and song are only returned after the seal is broken.
    Before that, they cannot be retrieved with any request.
    """
    status = get_status(record)
    view = {
        "id": record["id"],
        "title": record["title"],
        "created_at": record["created_at"],
        "open_at": record["open_at"],
        "opened_at": record["opened_at"],
        "status": status,
        "recipient_count": len(storage.recipients_of(record["id"])),
    }
    if status == CapsuleStatus.opened:
        view["message"] = record["message"]
        view["song"] = record["song"]
    return view


def get_record(capsule_id: int) -> dict[str, Any]:
    record = storage.capsules.get(capsule_id)
    if record is None:
        raise CapsuleNotFoundError(f"Capsule {capsule_id} was not found.")
    return record


def create_capsule(payload: CapsuleCreate) -> dict[str, Any]:
    open_at = _as_utc(payload.open_at)
    _check_open_at(open_at)

    capsule_id = storage.next_id("capsule")
    record = {
        "id": capsule_id,
        "title": payload.title,
        "message": payload.message,
        "created_at": utcnow(),
        "open_at": open_at,
        "opened_at": None,
        "song": payload.song.model_dump() if payload.song else None,
    }
    storage.capsules[capsule_id] = record
    return to_public(record)


def list_capsules(
    status: CapsuleStatus | None = None,
    search: str | None = None,
    limit: int = 20,
    offset: int = 0,
) -> list[dict[str, Any]]:
    items = [to_public(r) for r in storage.capsules.values()]
    if status is not None:
        items = [i for i in items if i["status"] == status]
    if search:
        needle = search.lower()
        items = [i for i in items if needle in i["title"].lower()]
    items.sort(key=lambda i: i["open_at"])
    return items[offset : offset + limit]


def get_capsule(capsule_id: int) -> dict[str, Any]:
    return to_public(get_record(capsule_id))


def update_capsule(capsule_id: int, payload: CapsuleUpdate) -> dict[str, Any]:
    record = get_record(capsule_id)
    if get_status(record) != CapsuleStatus.sealed:
        raise CapsuleNotEditableError("Only a sealed capsule can be edited.")

    changes = payload.model_dump(exclude_unset=True)
    if "open_at" in changes:
        new_open_at = _as_utc(changes["open_at"])
        _check_open_at(new_open_at)
        changes["open_at"] = new_open_at

    record.update(changes)
    return to_public(record)


def delete_capsule(capsule_id: int) -> None:
    get_record(capsule_id)
   # Cascade: deleting a capsule also deletes its recipients
    for recipient in storage.recipients_of(capsule_id):
        del storage.recipients[recipient["id"]]
    del storage.capsules[capsule_id]


#Break the seal

def open_capsule(capsule_id: int) -> dict[str, Any]:
    record = get_record(capsule_id)
    status = get_status(record)

    if status == CapsuleStatus.opened:
        raise AlreadyOpenedError("This capsule has already been opened.")
    if status == CapsuleStatus.sealed:
        raise CapsuleLockedError(f"This capsule cannot be opened before {record['open_at'].isoformat()}.")

    record["opened_at"] = utcnow()
    return to_public(record)
