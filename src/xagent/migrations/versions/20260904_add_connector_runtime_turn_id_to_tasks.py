"""add connector_runtime_turn_id to tasks

Revision ID: 20260904_add_connector_runtime_turn_id
Revises: 20260902_oauth_flow_generation
Create Date: 2026-09-04

Persists the turn id that owns a run's ephemeral connector secrets (see
connector_runtime.py's process-local ``_EPHEMERAL_RUNTIME_VALUES`` store) on
the Task row itself, written by the same claim UPDATE that mints ``run_id``.
Previously this id lived only in the cached AgentService's tool_config,
which a resume rebuild after cache eviction (idle reclamation, capacity
eviction, a scope-fingerprint mismatch) never re-supplied - the ephemeral
secrets a paused turn stored were still in memory, but nothing could look
them up anymore. No index: this column is only ever read alongside the row
it belongs to, never queried by value.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260904_add_connector_runtime_turn_id"
down_revision: Union[str, None] = "20260902_oauth_flow_generation"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "tasks" not in inspector.get_table_names():
        return

    existing_columns = {column["name"] for column in inspector.get_columns("tasks")}

    if "connector_runtime_turn_id" not in existing_columns:
        op.add_column(
            "tasks",
            sa.Column("connector_runtime_turn_id", sa.String(length=64), nullable=True),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "tasks" not in inspector.get_table_names():
        return

    existing_columns = {column["name"] for column in inspector.get_columns("tasks")}

    if "connector_runtime_turn_id" in existing_columns:
        op.drop_column("tasks", "connector_runtime_turn_id")
