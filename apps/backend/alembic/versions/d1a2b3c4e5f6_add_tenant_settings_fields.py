"""add tenant settings fields

Revision ID: d1a2b3c4e5f6
Revises: c0b1c2d3e4f5_add_tenant_contact_fields
Create Date: 2025-12-04 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd1a2b3c4e5f6'
down_revision = 'c0b1c2d3e4f5'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('tenants', sa.Column('city', sa.String(length=120), nullable=True))
    op.add_column('tenants', sa.Column('postal_code', sa.String(length=20), nullable=True))
    op.add_column('tenants', sa.Column('phone', sa.String(length=40), nullable=True))
    op.add_column('tenants', sa.Column('whatsapp_message', sa.Text(), nullable=True))
    op.add_column('tenants', sa.Column('rooms_count', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('tenants', 'rooms_count')
    op.drop_column('tenants', 'whatsapp_message')
    op.drop_column('tenants', 'phone')
    op.drop_column('tenants', 'postal_code')
    op.drop_column('tenants', 'city')
