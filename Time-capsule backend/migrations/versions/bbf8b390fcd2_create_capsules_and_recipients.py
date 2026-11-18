"""Таблицы капсул и получателей.

Revision ID: bbf8b390fcd2
Revises:
Create Date: 2026-11-17 23:25:01.175132

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'bbf8b390fcd2'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('capsules',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('title', sa.String(length=100), nullable=False),
    sa.Column('message', sa.String(length=5000), nullable=False),
    sa.Column('song', postgresql.JSONB(none_as_null=True, astext_type=sa.Text()), nullable=True),
    sa.Column('prediction', sa.String(length=240), nullable=True),
    sa.Column('reflection', sa.String(length=1500), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('open_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('opened_at', sa.DateTime(timezone=True), nullable=True),
    sa.CheckConstraint('open_at > created_at', name='valid_open_date'),
    sa.CheckConstraint('opened_at IS NULL OR opened_at >= open_at', name='valid_seal'),
    sa.CheckConstraint('reflection IS NULL OR opened_at IS NOT NULL', name='reflection_after_opening'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_capsules_open_at_id', 'capsules', ['open_at', 'id'], unique=False)
    op.create_table('recipients',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('capsule_id', sa.Integer(), nullable=False),
    sa.Column('email', sa.String(length=254), nullable=False),
    sa.Column('name', sa.String(length=100), nullable=True),
    sa.Column('added_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['capsule_id'], ['capsules.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('capsule_id', 'email', name='uq_capsule_recipient')
    )


def downgrade() -> None:
    op.drop_table('recipients')
    op.drop_index('ix_capsules_open_at_id', table_name='capsules')
    op.drop_table('capsules')
