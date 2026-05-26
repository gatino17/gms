"""add enrollment fee settings to tenants

Revision ID: 4c9d8e7f6a5b
Revises: f3a4b5c6d7e8
Create Date: 2026-05-26 10:40:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "4c9d8e7f6a5b"
down_revision = "f3a4b5c6d7e8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tenants",
        sa.Column("enrollment_fee_enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "tenants",
        sa.Column("enrollment_fee_amount", sa.Numeric(12, 2), nullable=True),
    )
    op.add_column(
        "tenants",
        sa.Column("enrollment_fee_apply_to", sa.String(length=30), nullable=True, server_default="new_only"),
    )
    op.add_column(
        "tenants",
        sa.Column("enrollment_fee_allow_waive", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("tenants", "enrollment_fee_allow_waive")
    op.drop_column("tenants", "enrollment_fee_apply_to")
    op.drop_column("tenants", "enrollment_fee_amount")
    op.drop_column("tenants", "enrollment_fee_enabled")

