"""Tests for the connector_runtime_turn_id-on-tasks migration."""

import importlib.util
from pathlib import Path
from unittest.mock import patch

import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations

MIGRATION_PATH = (
    Path(__file__).parents[2]
    / "src/xagent/migrations/versions/20260904_add_connector_runtime_turn_id_to_tasks.py"
)
TABLE = "tasks"
COLUMN = "connector_runtime_turn_id"


def _migration_module():
    spec = importlib.util.spec_from_file_location(
        "connector_runtime_turn_id_migration", MIGRATION_PATH
    )
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _operations(connection: sa.Connection) -> Operations:
    return Operations(MigrationContext.configure(connection))


def test_migration_adds_and_removes_the_column() -> None:
    migration = _migration_module()
    engine = sa.create_engine("sqlite:///:memory:")
    metadata = sa.MetaData()
    sa.Table(
        TABLE,
        metadata,
        sa.Column("id", sa.Integer(), primary_key=True),
    )
    metadata.create_all(engine)

    with engine.begin() as connection:
        with patch.object(migration, "op", _operations(connection)):
            migration.upgrade()
            # Idempotent: a second run must not raise (duplicate-column
            # error) or otherwise change the outcome.
            migration.upgrade()

            inspector = sa.inspect(connection)
            columns = {
                column["name"]: column for column in inspector.get_columns(TABLE)
            }
            assert COLUMN in columns
            assert columns[COLUMN]["nullable"] is True

            migration.downgrade()
            inspector = sa.inspect(connection)
            assert COLUMN not in {
                column["name"] for column in inspector.get_columns(TABLE)
            }
            # Idempotent in the other direction too.
            migration.downgrade()


def test_migration_noops_without_tasks_table() -> None:
    migration = _migration_module()
    engine = sa.create_engine("sqlite:///:memory:")

    with engine.begin() as connection:
        with patch.object(migration, "op", _operations(connection)):
            migration.upgrade()
            migration.downgrade()

        assert TABLE not in sa.inspect(connection).get_table_names()


def test_existing_rows_survive_the_migration_as_null() -> None:
    """A historical row must read back as NULL, not error or default to
    something that would misidentify it as belonging to a live turn."""
    migration = _migration_module()
    engine = sa.create_engine("sqlite:///:memory:")
    metadata = sa.MetaData()
    tasks = sa.Table(
        TABLE,
        metadata,
        sa.Column("id", sa.Integer(), primary_key=True),
    )
    metadata.create_all(engine)

    with engine.begin() as connection:
        connection.execute(tasks.insert().values(id=1))

        with patch.object(migration, "op", _operations(connection)):
            migration.upgrade()

        reflected = sa.Table(TABLE, sa.MetaData(), autoload_with=connection)
        row = connection.execute(
            sa.select(reflected.c[COLUMN]).where(reflected.c.id == 1)
        ).one()
        assert row[0] is None
