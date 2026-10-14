"""Add workspace channels, threaded messages, and versioned documents."""

from alembic import op
import sqlalchemy as sa


revision = "0004_collaboration"
down_revision = "0003_task_severity"
branch_labels = None
depends_on = None


def _timestamps():
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    ]


def upgrade():
    op.create_table(
        "channels",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("workspace_id", sa.String(36), sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("slug", sa.String(100), nullable=False),
        sa.Column("description", sa.String(500)),
        sa.Column("is_private", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_by", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        *_timestamps(),
        sa.UniqueConstraint("workspace_id", "slug", name="uq_channels_workspace_slug"),
    )
    op.create_index("ix_channels_workspace_id", "channels", ["workspace_id"])

    op.create_table(
        "channel_members",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("channel_id", sa.String(36), sa.ForeignKey("channels.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_by", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL")),
        *_timestamps(),
        sa.UniqueConstraint("channel_id", "user_id", name="uq_channel_members_channel_user"),
    )
    op.create_index("ix_channel_members_channel_id", "channel_members", ["channel_id"])
    op.create_index("ix_channel_members_user_id", "channel_members", ["user_id"])

    op.create_table(
        "channel_messages",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("channel_id", sa.String(36), sa.ForeignKey("channels.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("parent_message_id", sa.String(36), sa.ForeignKey("channel_messages.id", ondelete="SET NULL")),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("edited_at", sa.DateTime(timezone=True)),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.Column("created_by", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        *_timestamps(),
    )
    op.create_index("ix_channel_messages_channel_id", "channel_messages", ["channel_id"])
    op.create_index("ix_channel_messages_user_id", "channel_messages", ["user_id"])
    op.create_index("ix_channel_messages_parent_message_id", "channel_messages", ["parent_message_id"])
    op.create_index("ix_channel_messages_channel_created", "channel_messages", ["channel_id", "created_at"])
    op.create_index("ix_channel_messages_parent_created", "channel_messages", ["parent_message_id", "created_at"])

    op.create_table(
        "wiki_pages",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("workspace_id", sa.String(36), sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False),
        sa.Column("parent_page_id", sa.String(36), sa.ForeignKey("wiki_pages.id", ondelete="SET NULL")),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("slug", sa.String(220), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("icon", sa.String(32)),
        sa.Column("created_by", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("updated_by", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        *_timestamps(),
        sa.UniqueConstraint("workspace_id", "slug", name="uq_wiki_pages_workspace_slug"),
    )
    op.create_index("ix_wiki_pages_workspace_id", "wiki_pages", ["workspace_id"])
    op.create_index("ix_wiki_pages_parent_page_id", "wiki_pages", ["parent_page_id"])
    op.create_index("ix_wiki_pages_workspace_updated", "wiki_pages", ["workspace_id", "updated_at"])

    op.create_table(
        "wiki_versions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("page_id", sa.String(36), sa.ForeignKey("wiki_pages.id", ondelete="CASCADE"), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("change_summary", sa.String(300)),
        sa.Column("created_by", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        *_timestamps(),
        sa.UniqueConstraint("page_id", "version_number", name="uq_wiki_versions_page_version"),
    )
    op.create_index("ix_wiki_versions_page_id", "wiki_versions", ["page_id"])


def downgrade():
    op.drop_table("wiki_versions")
    op.drop_table("wiki_pages")
    op.drop_table("channel_messages")
    op.drop_table("channel_members")
    op.drop_table("channels")
