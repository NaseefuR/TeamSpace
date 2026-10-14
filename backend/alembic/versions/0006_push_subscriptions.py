"""Store browser push subscriptions."""

import sqlalchemy as sa

from alembic import op

revision = "0006_push_subscriptions"
down_revision = "0005_task_status_transitions"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "push_subscriptions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("endpoint", sa.Text(), nullable=False),
        sa.Column("endpoint_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("p256dh", sa.String(256), nullable=False),
        sa.Column("auth", sa.String(256), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_push_subscriptions_user_id", "push_subscriptions", ["user_id"])


def downgrade():
    op.drop_table("push_subscriptions")
