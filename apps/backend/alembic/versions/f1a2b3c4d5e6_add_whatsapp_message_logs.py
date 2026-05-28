"""add whatsapp message logs

Revision ID: f1a2b3c4d5e6
Revises: e5f6a7b8c9d1
Create Date: 2026-05-28
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "f1a2b3c4d5e6"
down_revision = "e5f6a7b8c9d1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "whatsapp_message_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=True),
        sa.Column("course_id", sa.Integer(), nullable=True),
        sa.Column("to_phone", sa.String(length=40), nullable=False),
        sa.Column("message_body", sa.Text(), nullable=True),
        sa.Column("sid", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=40), nullable=True),
        sa.Column("error_code", sa.String(length=40), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(), nullable=False),
        sa.ForeignKeyConstraint(["course_id"], ["courses.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_whatsapp_message_logs_course_id"), "whatsapp_message_logs", ["course_id"], unique=False)
    op.create_index(op.f("ix_whatsapp_message_logs_sid"), "whatsapp_message_logs", ["sid"], unique=True)
    op.create_index(op.f("ix_whatsapp_message_logs_status"), "whatsapp_message_logs", ["status"], unique=False)
    op.create_index(op.f("ix_whatsapp_message_logs_student_id"), "whatsapp_message_logs", ["student_id"], unique=False)
    op.create_index(op.f("ix_whatsapp_message_logs_tenant_id"), "whatsapp_message_logs", ["tenant_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_whatsapp_message_logs_tenant_id"), table_name="whatsapp_message_logs")
    op.drop_index(op.f("ix_whatsapp_message_logs_student_id"), table_name="whatsapp_message_logs")
    op.drop_index(op.f("ix_whatsapp_message_logs_status"), table_name="whatsapp_message_logs")
    op.drop_index(op.f("ix_whatsapp_message_logs_sid"), table_name="whatsapp_message_logs")
    op.drop_index(op.f("ix_whatsapp_message_logs_course_id"), table_name="whatsapp_message_logs")
    op.drop_table("whatsapp_message_logs")
