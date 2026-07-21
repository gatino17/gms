"""add announcement type

Revision ID: e8f9a0b1c2d3
Revises: d7e8f9a0b1c2
Create Date: 2026-07-21 18:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e8f9a0b1c2d3"
down_revision: Union[str, None] = "d7e8f9a0b1c2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "announcements",
        sa.Column("announcement_type", sa.String(length=30), nullable=True, server_default="important"),
    )


def downgrade() -> None:
    op.drop_column("announcements", "announcement_type")
