"""Initial local Demo schema."""
from alembic import op
import sqlalchemy as sa

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("installations", sa.Column("pack_id", sa.String(), primary_key=True),
                    sa.Column("installed_at", sa.String(), nullable=False))
    op.create_table("evidence", sa.Column("id", sa.String(), primary_key=True),
                    sa.Column("schema_version", sa.String(), nullable=False),
                    sa.Column("type", sa.String(), nullable=False),
                    sa.Column("task_id", sa.String(), nullable=False),
                    sa.Column("skill_id", sa.String(), nullable=False),
                    sa.Column("result_json", sa.Text(), nullable=False),
                    sa.Column("created_at", sa.String(), nullable=False),
                    sa.Column("source", sa.String(), nullable=False))
    op.create_table("pack_overrides", sa.Column("pack_id", sa.String(), primary_key=True),
                    sa.Column("plan_json", sa.Text(), nullable=False))
    op.create_table("events", sa.Column("event_id", sa.String(), primary_key=True),
                    sa.Column("event_type", sa.String(), nullable=False),
                    sa.Column("schema_version", sa.String(), nullable=False),
                    sa.Column("timestamp", sa.String(), nullable=False),
                    sa.Column("learner_id", sa.String(), nullable=False),
                    sa.Column("session_id", sa.String(), nullable=False),
                    sa.Column("source", sa.String(), nullable=False),
                    sa.Column("payload_json", sa.Text(), nullable=False))


def downgrade():
    op.drop_table("events")
    op.drop_table("pack_overrides")
    op.drop_table("evidence")
    op.drop_table("installations")
