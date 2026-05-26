"""add enrollment fee kind and renewal to tenants

Revision ID: 7d2c1a9b8e6f
Revises: 4c9d8e7f6a5b
Create Date: 2026-05-26 12:20:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "7d2c1a9b8e6f"
down_revision = "4c9d8e7f6a5b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tenants",
        sa.Column("enrollment_fee_kind", sa.String(length=20), nullable=True, server_default="incorporation"),
    )
    op.add_column(
        "tenants",
        sa.Column("enrollment_fee_renewal", sa.String(length=20), nullable=True, server_default="never"),
    )


def downgrade() -> None:
    op.drop_column("tenants", "enrollment_fee_renewal")
    op.drop_column("tenants", "enrollment_fee_kind")

