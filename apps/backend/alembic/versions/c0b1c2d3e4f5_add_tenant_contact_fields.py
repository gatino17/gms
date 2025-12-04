"""add tenant contact and location fields

Revision ID: c0b1c2d3e4f5
Revises: 6a3043698351
Create Date: 2025-11-27 15:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "c0b1c2d3e4f5"
down_revision = "6a3043698351"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tenants",
        sa.Column("contact_email", sa.String(length=150), nullable=True),
    )
    op.add_column(
        "tenants",
        sa.Column("address", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "tenants",
        sa.Column("country", sa.String(length=80), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("tenants", "country")
    op.drop_column("tenants", "address")
    op.drop_column("tenants", "contact_email")
