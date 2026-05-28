"""add teacher_name_snapshot to payments

Revision ID: b1c2d3e4f5a6
Revises: a9b8c7d6e5f4
Create Date: 2026-05-28 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "b1c2d3e4f5a6"
down_revision = "a9b8c7d6e5f4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("payments", sa.Column("teacher_name_snapshot", sa.String(length=160), nullable=True))


def downgrade() -> None:
    op.drop_column("payments", "teacher_name_snapshot")

