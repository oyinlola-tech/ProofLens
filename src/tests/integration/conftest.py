from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from asgi_lifespan import LifespanManager
from fastapi import FastAPI
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

import shared.infrastructure.database as database
from app.bootstrap import create_app
from shared.infrastructure.email import get_email_sender
from tests.conftest import _test_session_factory
from tests.integration.helpers import OUTBOX, RecordingEmailSender


@pytest_asyncio.fixture(loop_scope="session")
async def integration_session() -> AsyncGenerator[AsyncSession, None]:
    async with _test_session_factory() as sess:
        yield sess


@pytest.fixture(autouse=True)
async def _clear_rate_limits():
    async with _test_session_factory() as session:
        await session.execute(text("DELETE FROM rate_limits"))
        await session.commit()


@pytest.fixture
async def app(monkeypatch: pytest.MonkeyPatch) -> AsyncGenerator[FastAPI, None]:
    # Point the production get_session at the test database instead of overriding it,
    # so integration tests exercise the real commit/rollback behaviour.
    monkeypatch.setattr(database, "async_session_factory", _test_session_factory)
    application = create_app()
    OUTBOX.clear()
    application.dependency_overrides[get_email_sender] = RecordingEmailSender
    async with LifespanManager(application):
        yield application
