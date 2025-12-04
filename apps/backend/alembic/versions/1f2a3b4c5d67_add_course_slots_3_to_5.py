"""
Revision ID: 1f2a3b4c5d67
Revises: 8c1d2e3f4a56
Create Date: 2025-11-03 00:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '1f2a3b4c5d67'
down_revision = '8c1d2e3f4a56'
branch_labels = None
depends_on = None


def upgrade() -> None:
    for i in (3, 4, 5):
        op.add_column('courses', sa.Column(f'day_of_week_{i}', sa.Integer(), nullable=True))
        op.add_column('courses', sa.Column(f'start_time_{i}', sa.Time(), nullable=True))
        op.add_column('courses', sa.Column(f'end_time_{i}', sa.Time(), nullable=True))


def downgrade() -> None:
    for i in (5, 4, 3):
        op.drop_column('courses', f'end_time_{i}')
        op.drop_column('courses', f'start_time_{i}')
        op.drop_column('courses', f'day_of_week_{i}')

