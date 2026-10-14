"""Initial normalized core schema."""
from alembic import op
from app import models  # noqa: F401
from app.db.base import Base

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None

INITIAL_TABLE_NAMES = (
    "users",
    "user_sessions",
    "workspaces",
    "workspace_members",
    "teams",
    "team_members",
    "projects",
    "workflow_statuses",
    "tasks",
    "outbox_events",
    "knowledge_projects",
    "knowledge_versions",
)


def upgrade():
    tables = [Base.metadata.tables[name] for name in INITIAL_TABLE_NAMES]
    Base.metadata.create_all(bind=op.get_bind(), tables=tables)


def downgrade():
    tables = [Base.metadata.tables[name] for name in INITIAL_TABLE_NAMES]
    Base.metadata.drop_all(bind=op.get_bind(), tables=tables)
