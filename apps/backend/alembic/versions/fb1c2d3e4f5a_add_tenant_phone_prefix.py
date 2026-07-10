"""add tenant phone prefix

Revision ID: fb1c2d3e4f5a
Revises: fa0b1c2d3e4f
Create Date: 2026-07-10 11:20:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "fb1c2d3e4f5a"
down_revision = "fa0b1c2d3e4f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("tenants", sa.Column("phone_prefix", sa.String(length=10), nullable=True, server_default="+56"))


def downgrade() -> None:
    op.drop_column("tenants", "phone_prefix")
