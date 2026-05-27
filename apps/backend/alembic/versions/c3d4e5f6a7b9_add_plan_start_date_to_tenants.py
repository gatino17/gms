"""add plan start date to tenants

Revision ID: c3d4e5f6a7b9
Revises: b2c3d4e5f6a8
Create Date: 2026-05-27 17:10:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "c3d4e5f6a7b9"
down_revision = "b2c3d4e5f6a8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("tenants", sa.Column("plan_start_date", sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("tenants", "plan_start_date")
