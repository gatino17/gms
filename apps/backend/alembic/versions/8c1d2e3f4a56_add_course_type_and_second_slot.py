"""
Revision ID: 8c1d2e3f4a56
Revises: b7c3a8d1c2ab
Create Date: 2025-11-03 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '8c1d2e3f4a56'
down_revision = 'b7c3a8d1c2ab'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('courses', sa.Column('course_type', sa.String(length=20), nullable=True))
    op.add_column('courses', sa.Column('total_classes', sa.Integer(), nullable=True))
    op.add_column('courses', sa.Column('classes_per_week', sa.Integer(), nullable=True))
    op.add_column('courses', sa.Column('day_of_week_2', sa.Integer(), nullable=True))
    op.add_column('courses', sa.Column('start_time_2', sa.Time(), nullable=True))
    op.add_column('courses', sa.Column('end_time_2', sa.Time(), nullable=True))


def downgrade() -> None:
    op.drop_column('courses', 'end_time_2')
    op.drop_column('courses', 'start_time_2')
    op.drop_column('courses', 'day_of_week_2')
    op.drop_column('courses', 'classes_per_week')
    op.drop_column('courses', 'total_classes')
    op.drop_column('courses', 'course_type')

