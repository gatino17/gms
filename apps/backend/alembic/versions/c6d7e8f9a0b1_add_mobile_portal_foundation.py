"""add mobile portal foundation

Revision ID: c6d7e8f9a0b1
Revises: fb1c2d3e4f5a
Create Date: 2026-07-21
"""

from alembic import op
import sqlalchemy as sa


revision = "c6d7e8f9a0b1"
down_revision = "fb1c2d3e4f5a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("role", sa.String(length=20), nullable=False, server_default="admin"))
    op.create_index(op.f("ix_users_role"), "users", ["role"], unique=False)
    op.execute("UPDATE users SET role = 'admin' WHERE role IS NULL OR trim(role) = ''")
    op.execute("ALTER TABLE users ALTER COLUMN role DROP DEFAULT")

    op.add_column("tenants", sa.Column("mobile_enabled", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("tenants", sa.Column("teacher_portal_enabled", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("tenants", sa.Column("student_portal_enabled", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("tenants", sa.Column("online_payments_enabled", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.execute("ALTER TABLE tenants ALTER COLUMN mobile_enabled DROP DEFAULT")
    op.execute("ALTER TABLE tenants ALTER COLUMN teacher_portal_enabled DROP DEFAULT")
    op.execute("ALTER TABLE tenants ALTER COLUMN student_portal_enabled DROP DEFAULT")
    op.execute("ALTER TABLE tenants ALTER COLUMN online_payments_enabled DROP DEFAULT")

    op.add_column("teachers", sa.Column("user_id", sa.Integer(), nullable=True))
    op.add_column("teachers", sa.Column("portal_enabled", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.create_index(op.f("ix_teachers_user_id"), "teachers", ["user_id"], unique=False)
    op.create_foreign_key(
        "fk_teachers_user_id_users",
        "teachers",
        "users",
        ["user_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.execute("ALTER TABLE teachers ALTER COLUMN portal_enabled DROP DEFAULT")


def downgrade() -> None:
    op.drop_constraint("fk_teachers_user_id_users", "teachers", type_="foreignkey")
    op.drop_index(op.f("ix_teachers_user_id"), table_name="teachers")
    op.drop_column("teachers", "portal_enabled")
    op.drop_column("teachers", "user_id")

    op.drop_column("tenants", "online_payments_enabled")
    op.drop_column("tenants", "student_portal_enabled")
    op.drop_column("tenants", "teacher_portal_enabled")
    op.drop_column("tenants", "mobile_enabled")

    op.drop_index(op.f("ix_users_role"), table_name="users")
    op.drop_column("users", "role")
