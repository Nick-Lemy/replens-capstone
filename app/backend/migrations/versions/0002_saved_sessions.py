from alembic import op
import sqlalchemy as sa


revision = "0002_saved_sessions"
down_revision = "0001_auth"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "saved_sessions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("auth_users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(120), nullable=False),
        sa.Column("result", sa.JSON(), nullable=False),
        sa.Column("review", sa.JSON()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_saved_sessions_owner_created", "saved_sessions", ["user_id", "created_at"])


def downgrade():
    op.drop_table("saved_sessions")
