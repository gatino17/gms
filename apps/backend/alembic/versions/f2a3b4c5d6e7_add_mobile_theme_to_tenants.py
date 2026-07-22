"""add mobile theme to tenants

Revision ID: f2a3b4c5d6e7
Revises: f0a1b2c3d4e5
Create Date: 2026-07-22 12:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f2a3b4c5d6e7"
down_revision: Union[str, None] = "f0a1b2c3d4e5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "tenants",
        sa.Column("mobile_theme", sa.String(length=30), nullable=True, server_default="gms_default"),
    )


def downgrade() -> None:
    op.drop_column("tenants", "mobile_theme")
