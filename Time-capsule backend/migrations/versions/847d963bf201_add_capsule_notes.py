"""Записки с подписью для групповых капсул."""
from alembic import op
import sqlalchemy as sa

revision = "847d963bf201"
down_revision = "bbf8b390fcd2"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "capsule_notes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("capsule_id", sa.Integer(), sa.ForeignKey("capsules.id", ondelete="CASCADE"), nullable=False),
        sa.Column("signature", sa.String(80), nullable=False),
        sa.Column("text", sa.String(600), nullable=False),
        sa.CheckConstraint("length(trim(signature)) > 0 AND length(trim(text)) > 0", name="nonempty_note"),
    )
    # При открытии читаем записки одной капсулы в порядке добавления.
    op.create_index("ix_capsule_notes_capsule_id_id", "capsule_notes", ["capsule_id", "id"])


def downgrade():
    op.drop_table("capsule_notes")
