"""
Revision ID: b7c3a8d1c2ab
Revises: aa0e941fe12b, 9b2c1d4a3f10
Create Date: 2025-10-24 00:05:00.000000

"""
from alembic import op  # noqa: F401
import sqlalchemy as sa  # noqa: F401


# revision identifiers, used by Alembic.
revision = 'b7c3a8d1c2ab'
down_revision = ('aa0e941fe12b', '9b2c1d4a3f10')
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Merge-only revision; no operations.
    pass


def downgrade() -> None:
    # Merge-only revision; no operations.
    pass

