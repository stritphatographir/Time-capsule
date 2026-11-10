"""Capsule recipients"""
from typing import Any

from app import storage
from app.exceptions import (
    CapsuleNotEditableError,
    DuplicateRecipientError,
    RecipientLimitError,
    RecipientNotFoundError,
)
from app.schemas.capsule import CapsuleStatus
from app.schemas.recipient import RecipientCreate
from app.services import capsule_service

MAX_RECIPIENTS = 20


def _get_sealed_capsule(capsule_id: int) -> None:
    """Recipients can only be changed while the capsule is sealed."""
    record = capsule_service.get_record(capsule_id)
    if capsule_service.get_status(record) != CapsuleStatus.sealed:
        raise CapsuleNotEditableError("Recipients can only be changed while the capsule is sealed.")


def list_recipients(capsule_id: int) -> list[dict[str, Any]]:
    capsule_service.get_record(capsule_id)
    return storage.recipients_of(capsule_id)


def add_recipient(capsule_id: int, payload: RecipientCreate) -> dict[str, Any]:
    _get_sealed_capsule(capsule_id)

    existing = storage.recipients_of(capsule_id)
    if len(existing) >= MAX_RECIPIENTS:
        raise RecipientLimitError(f"A capsule can have at most {MAX_RECIPIENTS} recipients.")
    if any(r["email"] == payload.email for r in existing):
        raise DuplicateRecipientError(f"{payload.email} is already a recipient of this capsule.")

    recipient_id = storage.next_id("recipient")
    record = {
        "id": recipient_id,
        "capsule_id": capsule_id,
        "email": payload.email,
        "name": payload.name,
        "added_at": capsule_service.utcnow(),
    }
    storage.recipients[recipient_id] = record
    return record


def remove_recipient(capsule_id: int, recipient_id: int) -> None:
    capsule_service.get_record(capsule_id)

    recipient = storage.recipients.get(recipient_id)
    if recipient is None or recipient["capsule_id"] != capsule_id:
        raise RecipientNotFoundError(f"Recipient {recipient_id} was not found in capsule {capsule_id}.")

    _get_sealed_capsule(capsule_id)
    del storage.recipients[recipient_id]
