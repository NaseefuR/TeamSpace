"""Add in-app notifications."""
from alembic import op
from app.models.entities import Notification

revision = "0002_notifications"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade():
    Notification.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade():
    Notification.__table__.drop(bind=op.get_bind(), checkfirst=True)
