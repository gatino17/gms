"""add logo_url and navbar_theme to tenants"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "f3a4b5c6d7e8"
down_revision = "e2f3g4h5i6j7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("tenants", sa.Column("navbar_theme", sa.String(length=30), nullable=True))
    op.add_column("tenants", sa.Column("logo_url", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("tenants", "logo_url")
    op.drop_column("tenants", "navbar_theme")
