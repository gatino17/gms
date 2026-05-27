"""add max sessions to tenants

Revision ID: e5f6a7b8c9d1
Revises: d4e5f6a7b8c0
Create Date: 2026-05-27
"""

from alembic import op
import sqlalchemy as sa


revision = "e5f6a7b8c9d1"
down_revision = "d4e5f6a7b8c0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("tenants", sa.Column("max_sessions", sa.Integer(), nullable=False, server_default="3"))
    op.execute("UPDATE tenants SET max_sessions = 3 WHERE max_sessions IS NULL")
    op.execute("ALTER TABLE tenants ALTER COLUMN max_sessions DROP DEFAULT")


def downgrade() -> None:
    op.drop_column("tenants", "max_sessions")

