"""Store legacy lesson timers and completion state."""

from alembic import op

revision = "0011_legacy_lesson_progress"
down_revision = "0010_class_lms_mode"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        "ALTER TABLE lab_progress ADD COLUMN IF NOT EXISTS lesson_progress JSONB NOT NULL DEFAULT '{}'"
    )


def downgrade():
    # Keep progress data on downgrade; the additive column is harmless.
    pass
