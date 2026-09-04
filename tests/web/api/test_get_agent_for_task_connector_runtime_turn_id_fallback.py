"""``get_agent_for_task``'s fallback to the persisted connector_runtime_turn_id.

A caller that rebuilds/resyncs a task's cached agent after losing it to
eviction (idle reclamation, capacity eviction, a scope-fingerprint mismatch)
has no live turn_id of its own to pass - every resume path (websocket
explicit/message-triggered resume, v1 reply, A2A, the channel bots) omits it.
Without a fallback, the resynced tool_config would look up ephemeral
connector secrets under None even though a still-live turn's secrets are
sitting in connector_runtime.py's process-local store, addressable only by
the id the original CREATE/APPEND claim persisted on the row (see
Task.connector_runtime_turn_id's own comment).

These tests drive the cache-hit resync path (``_sync_connector_runtime_turn``,
called unconditionally at the end of ``_get_agent_for_task_unlocked``) since
it needs the least scaffolding to exercise the fallback in isolation - the
same local variable it reads from also feeds the fresh-build path.
"""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from xagent.web.api.chat import AgentServiceManager
from xagent.web.models.agent import AgentStatus
from xagent.web.models.task import Task, TaskStatus
from xagent.web.models.user import User
from xagent.web.services.llm_utils import AgentRuntimeFields
from xagent.web.services.task_setup_snapshot import (
    RuntimeUserFields,
    TaskSetupSnapshot,
    _TaskFields,
)


def _make_user() -> User:
    return User(
        id=1, username="turn-fallback-user", password_hash="hash", is_admin=False
    )


def _make_task_row() -> Task:
    return Task(
        id=42,
        user_id=1,
        title="turn-fallback task",
        description="x",
        status=TaskStatus.PENDING,
        agent_id=7,
        agent_type="standard",
    )


def _build_db_mock(task_row: Task) -> MagicMock:
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = task_row
    return db


def _build_snapshot(*, connector_runtime_turn_id: str | None) -> TaskSetupSnapshot:
    return TaskSetupSnapshot(
        task=_TaskFields(
            id=42,
            user_id=1,
            status=TaskStatus.PENDING,
            agent_id=7,
            agent_config=None,
            model_name=None,
            compact_model_name=None,
            execution_mode="flash",
            agent_type="standard",
            connector_runtime_turn_id=connector_runtime_turn_id,
        ),
        runtime_user=RuntimeUserFields(id=1, is_admin=False),
        has_reconstructable_history=False,
        task_pattern="single_call",
        task_llm=None,
        task_fast_llm=None,
        task_vision_llm=None,
        task_compact_llm=None,
        agent=AgentRuntimeFields(
            id=7,
            name="turn-fallback-agent",
            status=AgentStatus.PUBLISHED,
            instructions="be terse",
        ),
        agent_config={
            "llms": (None, None, None, None),
            "execution_mode": "flash",
            "instructions": "be terse",
            "skills": [],
            "knowledge_bases": [],
            "tool_categories": ["basic"],
        },
        excluded_agent_id=7,
    )


class _TurnTrackingToolConfig:
    """Minimal ``WebToolConfig`` stand-in: records every turn id it is handed."""

    def __init__(self) -> None:
        self.set_calls: list[str] = []

    def set_connector_runtime_turn_id(self, turn_id: str) -> bool:
        self.set_calls.append(turn_id)
        return True


class _CachedAgentWithToolConfig:
    def __init__(self, tool_config: _TurnTrackingToolConfig) -> None:
        self.tool_config = tool_config

    def invalidate_tools(self) -> None:
        pass

    def cleanup_workspace(self) -> None:
        pass


@pytest.mark.asyncio
async def test_omitted_turn_id_falls_back_to_the_persisted_one() -> None:
    tool_config = _TurnTrackingToolConfig()
    cached_agent = _CachedAgentWithToolConfig(tool_config)
    manager = AgentServiceManager()
    manager._agents[42] = cached_agent
    manager._agent_owner_ids[42] = 1
    manager._agent_scope_fingerprints[42] = None

    result = await manager.get_agent_for_task(
        task_id=42,
        db=_build_db_mock(_make_task_row()),
        user=_make_user(),
        task_setup_snapshot=_build_snapshot(connector_runtime_turn_id="persisted-turn"),
    )

    assert result is cached_agent
    assert tool_config.set_calls == ["persisted-turn"]


@pytest.mark.asyncio
async def test_explicit_turn_id_is_not_overridden_by_the_persisted_one() -> None:
    """The normal execution path always knows its own live turn_id and
    passes it explicitly - a stale persisted value (e.g. this task's
    previous, already-finished run) must never override it."""
    tool_config = _TurnTrackingToolConfig()
    cached_agent = _CachedAgentWithToolConfig(tool_config)
    manager = AgentServiceManager()
    manager._agents[42] = cached_agent
    manager._agent_owner_ids[42] = 1
    manager._agent_scope_fingerprints[42] = None

    result = await manager.get_agent_for_task(
        task_id=42,
        db=_build_db_mock(_make_task_row()),
        user=_make_user(),
        task_setup_snapshot=_build_snapshot(
            connector_runtime_turn_id="stale-persisted-turn"
        ),
        connector_runtime_turn_id="live-turn",
    )

    assert result is cached_agent
    assert tool_config.set_calls == ["live-turn"]


@pytest.mark.asyncio
async def test_no_persisted_turn_id_and_none_passed_skips_the_sync() -> None:
    """A historical/never-populated row (NULL column) must not sync a
    literal None onto the tool config - _sync_connector_runtime_turn's own
    falsy-value guard already covers this, pinned here so the fallback
    change can't accidentally make it start calling set_connector_runtime_
    turn_id(None)."""
    tool_config = _TurnTrackingToolConfig()
    cached_agent = _CachedAgentWithToolConfig(tool_config)
    manager = AgentServiceManager()
    manager._agents[42] = cached_agent
    manager._agent_owner_ids[42] = 1
    manager._agent_scope_fingerprints[42] = None

    result = await manager.get_agent_for_task(
        task_id=42,
        db=_build_db_mock(_make_task_row()),
        user=_make_user(),
        task_setup_snapshot=_build_snapshot(connector_runtime_turn_id=None),
    )

    assert result is cached_agent
    assert tool_config.set_calls == []
