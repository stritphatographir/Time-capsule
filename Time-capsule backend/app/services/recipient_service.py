from sqlalchemy import select
from app.models import Recipient
from app.exceptions import DuplicateRecipientError, RecipientLimitError, RecipientNotFoundError
from app.services import capsule_service

MAX_RECIPIENTS = 20


def list_recipients(db, capsule_id):
    capsule_service.get_record(db, capsule_id)
    return db.scalars(select(Recipient).where(Recipient.capsule_id == capsule_id).order_by(Recipient.id)).all()


def add_recipient(db, capsule_id, payload):
    parent = capsule_service.get_record(db, capsule_id, lock=True)
    capsule_service.require_sealed(parent)
    if len(parent.recipients) >= MAX_RECIPIENTS:
        raise RecipientLimitError(f"A capsule can have at most {MAX_RECIPIENTS} recipients.")
    if any(item.email == payload.email for item in parent.recipients):
        raise DuplicateRecipientError("This email is already a recipient.")
    recipient = Recipient(capsule_id=capsule_id, **payload.model_dump(), added_at=capsule_service.utcnow())
    db.add(recipient)
    db.commit()
    return recipient


def remove_recipient(db, capsule_id, recipient_id):
    parent = capsule_service.get_record(db, capsule_id, lock=True)
    recipient = db.get(Recipient, recipient_id)
    if recipient is None or recipient.capsule_id != capsule_id:
        raise RecipientNotFoundError("Recipient was not found in this capsule.")
    capsule_service.require_sealed(parent)
    db.delete(recipient)
    db.commit()
