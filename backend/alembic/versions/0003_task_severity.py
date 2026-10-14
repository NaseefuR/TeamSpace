"""Add severity to tasks."""

import sqlalchemy as sa

from alembic import op

revision = "0003_task_severity"
down_revision = "0002_notifications"
branch_labels = None
depends_on = None


def upgrade():
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("tasks")}
    if "severity" not in columns:
        op.add_column(
            "tasks",
            sa.Column("severity", sa.String(length=16), nullable=False, server_default="medium"),
        )


def downgrade():
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("tasks")}
    if "severity" in columns:
        op.drop_column("tasks", "severity")
