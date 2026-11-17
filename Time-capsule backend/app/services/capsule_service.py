import os
from datetime import datetime, timedelta, timezone

from sqlalchemy import extract, func, select
from sqlalchemy.orm import Session, selectinload

from app.models import Capsule, CapsuleNote
from app.exceptions import (
    AlreadyOpenedError,
    CapsuleLockedError,
    CapsuleNotEditableError,
    CapsuleNotFoundError,
    InvalidOpenDateError,
    NoteLimitError,
)
from app.schemas.capsule import CapsuleCreate, CapsuleStatus, CapsuleUpdate, SignedNote

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



def get_record(db: Session, capsule_id: int, *, lock=False) -> Capsule:
    query = select(Capsule).where(Capsule.id == capsule_id)
    row = db.scalar(query.with_for_update() if lock else query)
    if row is None:
        raise CapsuleNotFoundError(f"Capsule {capsule_id} was not found.")
    return row


def public(row, now):
    opened = row.opened_at is not None
    status = "opened" if opened else ("ready" if row.open_at <= now else "sealed")
    return dict(id=row.id, title=row.title, created_at=row.created_at, open_at=row.open_at,
                opened_at=row.opened_at, status=status, recipient_count=len(row.recipients),
                message=row.message if opened else None, song=row.song if opened else None,
                prediction=row.prediction if opened else None, reflection=row.reflection if opened else None)


def require_sealed(row):
    if row.opened_at is not None or row.open_at <= utcnow():
        raise CapsuleNotEditableError("Only a sealed capsule can be edited.")


def create_capsule(db: Session, payload: CapsuleCreate):
    values = payload.model_dump()
    values["open_at"] = _as_utc(payload.open_at)
    _check_open_at(values["open_at"])
    row = Capsule(**values, created_at=utcnow())
    db.add(row)
    db.commit()
    return public(row, utcnow())


def list_capsules(db: Session, status=None, search=None, limit=20, offset=0):
    now = utcnow()
    query = select(Capsule).options(selectinload(Capsule.recipients))
    if status == CapsuleStatus.opened:
        query = query.where(Capsule.opened_at.is_not(None))
    elif status in (CapsuleStatus.ready, CapsuleStatus.sealed):
        due = Capsule.open_at <= now
        query = query.where(Capsule.opened_at.is_(None), due if status == CapsuleStatus.ready else ~due)
    if search:
        query = query.where(Capsule.title.icontains(search, autoescape=True))
    rows = db.scalars(query.order_by(Capsule.open_at, Capsule.id).limit(limit).offset(offset))
    return [public(row, now) for row in rows]


MAX_NOTES = 20


def note_count(db, capsule_id):
    return db.scalar(select(func.count()).select_from(CapsuleNote).where(CapsuleNote.capsule_id == capsule_id))


def capsule_detail(db, row, now):
    data = public(row, now)
    if row.opened_at is None:
        return {**data, "note_count": note_count(db, row.id), "notes": []}
    query = select(CapsuleNote.signature, CapsuleNote.text).where(CapsuleNote.capsule_id == row.id)
    notes = db.execute(query.order_by(CapsuleNote.id)).mappings().all()
    return {**data, "note_count": len(notes), "notes": notes}


def get_capsule(db, capsule_id):
    return capsule_detail(db, get_record(db, capsule_id), utcnow())


def add_note(db: Session, capsule_id: int, payload: SignedNote):
    row = get_record(db, capsule_id, lock=True)
    require_sealed(row)
    count = note_count(db, row.id)
    if count >= MAX_NOTES:
        raise NoteLimitError(f"A capsule can hold at most {MAX_NOTES} notes.")
    db.add(CapsuleNote(capsule_id=row.id, **payload.model_dump()))
    db.commit()
    return {"note_count": count + 1}


def update_capsule(db, capsule_id, payload: CapsuleUpdate):
    row = get_record(db, capsule_id, lock=True)
    require_sealed(row)
    changes = payload.model_dump(exclude_unset=True)
    if "open_at" in changes:
        changes["open_at"] = _as_utc(changes["open_at"])
        _check_open_at(changes["open_at"])
    for field, value in changes.items():
        setattr(row, field, value)
    db.commit()
    return public(row, utcnow())


def delete_capsule(db, capsule_id):
    db.delete(get_record(db, capsule_id, lock=True))
    db.commit()


def open_capsule(db, capsule_id):
    row = get_record(db, capsule_id, lock=True)
    if row.opened_at is not None:
        raise AlreadyOpenedError("This capsule has already been opened.")
    now = utcnow()
    if now < row.open_at:
        raise CapsuleLockedError(f"This capsule cannot be opened before {row.open_at.isoformat()}.")
    row.opened_at = now
    db.commit()
    return capsule_detail(db, row, now)


def record_reflection(db, capsule_id, text):
    row = get_record(db, capsule_id, lock=True)
    if row.opened_at is None:
        raise CapsuleLockedError("Open your capsule before reflecting on it.")
    row.reflection = text
    db.commit()
    return public(row, utcnow())


def anniversaries(db, day, limit, offset):
    opened_utc = func.timezone("UTC", Capsule.opened_at)
    rows = db.scalars(select(Capsule).options(selectinload(Capsule.recipients)).where(
        extract("month", opened_utc) == day.month,
        extract("day", opened_utc) == day.day,
        extract("year", opened_utc) < day.year,
    ).order_by(Capsule.opened_at.desc(), Capsule.id).limit(limit).offset(offset))
    return [public(row, utcnow()) for row in rows]
