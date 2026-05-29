"""add whatsapp cost fields

Revision ID: f9a1b2c3d4e5
Revises: e5f6a7b8c9d1
Create Date: 2026-05-29 13:10:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "f9a1b2c3d4e5"
down_revision = "e5f6a7b8c9d1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("whatsapp_message_logs", sa.Column("price_usd", sa.Numeric(10, 5), nullable=True))
    op.add_column("whatsapp_message_logs", sa.Column("price_unit", sa.String(length=10), nullable=True))


def downgrade() -> None:
    op.drop_column("whatsapp_message_logs", "price_unit")
    op.drop_column("whatsapp_message_logs", "price_usd")

