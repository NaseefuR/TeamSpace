"""Add workspace document uploads."""

import sqlalchemy as sa

from alembic import op

revision = "0007_workspace_files"
down_revision = "0006_push_subscriptions"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "workspace_files",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "workspace_id",
            sa.String(36),
            sa.ForeignKey("workspaces.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("storage_key", sa.String(100), nullable=False, unique=True),
        sa.Column("content_type", sa.String(160), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("uploaded_by", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_workspace_files_workspace_id", "workspace_files", ["workspace_id"])
    op.create_index(
        "ix_workspace_files_workspace_created", "workspace_files", ["workspace_id", "created_at"]
    )


def downgrade():
    op.drop_table("workspace_files")
