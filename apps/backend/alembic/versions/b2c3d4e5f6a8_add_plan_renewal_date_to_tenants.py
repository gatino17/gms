"""add plan renewal date to tenants

Revision ID: b2c3d4e5f6a8
Revises: a1b2c3d4e5f7
Create Date: 2026-05-27 16:20:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "b2c3d4e5f6a8"
down_revision = "a1b2c3d4e5f7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("tenants", sa.Column("plan_renewal_date", sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("tenants", "plan_renewal_date")
