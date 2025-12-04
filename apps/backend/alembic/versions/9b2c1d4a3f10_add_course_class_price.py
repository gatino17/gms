"""
Revision ID: 9b2c1d4a3f10
Revises: 0fca1b0b627c
Create Date: 2025-10-24 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '9b2c1d4a3f10'
down_revision = '0fca1b0b627c'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('courses', sa.Column('class_price', sa.Numeric(precision=10, scale=2), nullable=True))


def downgrade() -> None:
    op.drop_column('courses', 'class_price')

