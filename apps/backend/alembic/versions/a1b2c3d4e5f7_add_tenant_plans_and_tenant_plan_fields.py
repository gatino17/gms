"""add tenant plans and tenant plan fields

Revision ID: a1b2c3d4e5f7
Revises: 7d2c1a9b8e6f
Create Date: 2026-05-27 12:30:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f7"
down_revision = "7d2c1a9b8e6f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tenant_plans",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("max_active_students", sa.Integer(), nullable=False),
        sa.Column("monthly_price", sa.Numeric(12, 2), nullable=False),
        sa.Column("annual_price", sa.Numeric(12, 2), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("is_custom", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.TIMESTAMP(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_tenant_plans_is_active", "tenant_plans", ["is_active"])

    op.add_column("tenants", sa.Column("plan_id", sa.Integer(), nullable=True))
    op.add_column("tenants", sa.Column("billing_cycle", sa.String(length=20), nullable=True, server_default="monthly"))
    op.add_column("tenants", sa.Column("price_locked", sa.Numeric(12, 2), nullable=True))
    op.add_column("tenants", sa.Column("plan_label_snapshot", sa.String(length=120), nullable=True))
    op.create_index("ix_tenants_plan_id", "tenants", ["plan_id"])
    op.create_foreign_key(
        "fk_tenants_plan_id_tenant_plans",
        "tenants",
        "tenant_plans",
        ["plan_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_tenants_plan_id_tenant_plans", "tenants", type_="foreignkey")
    op.drop_index("ix_tenants_plan_id", table_name="tenants")
    op.drop_column("tenants", "plan_label_snapshot")
    op.drop_column("tenants", "price_locked")
    op.drop_column("tenants", "billing_cycle")
    op.drop_column("tenants", "plan_id")

    op.drop_index("ix_tenant_plans_is_active", table_name="tenant_plans")
    op.drop_table("tenant_plans")
