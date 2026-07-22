"""add student portal enabled

Revision ID: f4a5b6c7d8e9
Revises: f2a3b4c5d6e7
Create Date: 2026-07-22 18:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f4a5b6c7d8e9"
down_revision: Union[str, None] = "f2a3b4c5d6e7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "students",
        sa.Column("portal_enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.execute("ALTER TABLE students ALTER COLUMN portal_enabled DROP DEFAULT")


def downgrade() -> None:
    op.drop_column("students", "portal_enabled")
