"""add sidebar_theme to tenant

Revision ID: e2f3g4h5i6j7
Revises: d1a2b3c4e5f6
Create Date: 2025-12-04 00:30:00.000000
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e2f3g4h5i6j7'
down_revision = 'd1a2b3c4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('tenants', sa.Column('sidebar_theme', sa.String(length=30), nullable=True))


def downgrade() -> None:
    op.drop_column('tenants', 'sidebar_theme')
