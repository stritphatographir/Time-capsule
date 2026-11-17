from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Capsule(Base):
    __tablename__ = "capsules"
    __table_args__ = (
        CheckConstraint("open_at > created_at", name="valid_open_date"),
        CheckConstraint("opened_at IS NULL OR opened_at >= open_at", name="valid_seal"),
        CheckConstraint("reflection IS NULL OR opened_at IS NOT NULL", name="reflection_after_opening"),
        Index("ix_capsules_open_at_id", "open_at", "id"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(100))
    message: Mapped[str] = mapped_column(String(5000))
    song: Mapped[dict | None] = mapped_column(JSONB(none_as_null=True))
    prediction: Mapped[str | None] = mapped_column(String(240))
    reflection: Mapped[str | None] = mapped_column(String(1500))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    open_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    opened_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    recipients: Mapped[list["Recipient"]] = relationship(back_populates="capsule", cascade="all, delete-orphan", passive_deletes=True)


class Recipient(Base):
    __tablename__ = "recipients"
    __table_args__ = (UniqueConstraint("capsule_id", "email", name="uq_capsule_recipient"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    capsule_id: Mapped[int] = mapped_column(ForeignKey("capsules.id", ondelete="CASCADE"))
    email: Mapped[str] = mapped_column(String(254))
    name: Mapped[str | None] = mapped_column(String(100))
    added_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    capsule: Mapped[Capsule] = relationship(back_populates="recipients")
