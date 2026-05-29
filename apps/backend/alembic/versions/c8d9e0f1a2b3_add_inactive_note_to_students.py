"""add inactive note fields to students

Revision ID: c8d9e0f1a2b3
Revises: b1c2d3e4f5a6
Create Date: 2026-05-28 22:20:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "c8d9e0f1a2b3"
down_revision = "b1c2d3e4f5a6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("students", sa.Column("inactive_note", sa.Text(), nullable=True))
    op.add_column("students", sa.Column("inactive_at", sa.TIMESTAMP(), nullable=True))


def downgrade() -> None:
    op.drop_column("students", "inactive_at")
    op.drop_column("students", "inactive_note")

