"""Record task status handoffs."""

from alembic import op
import sqlalchemy as sa


revision = "0005_task_status_transitions"
down_revision = "0004_collaboration"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "task_status_transitions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "task_id",
            sa.String(36),
            sa.ForeignKey("tasks.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("from_status", sa.String(64), nullable=False),
        sa.Column("to_status", sa.String(64), nullable=False),
        sa.Column("work_done", sa.Text(), nullable=False),
        sa.Column("next_needs", sa.Text(), nullable=False),
        sa.Column(
            "actor_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
        ),
        sa.Column("actor_name", sa.String(160), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index(
        "ix_task_status_transitions_actor_id", "task_status_transitions", ["actor_id"]
    )
    op.create_index(
        "ix_task_status_transitions_task_created",
        "task_status_transitions",
        ["task_id", "created_at"],
    )


def downgrade():
    op.drop_table("task_status_transitions")
