"""Runs the real Alembic chain against a throwaway database.

The rest of the suite builds tables with metadata.create_all, which cannot catch a
broken migration or drift between the models and the migrations.
"""
from __future__ import annotations

import asyncio
import os
import subprocess
import sys
from pathlib import Path

import pytest
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import create_async_engine

import modules.claims.infrastructure.persistence.claim_model  # noqa: F401
import modules.documents.infrastructure.persistence.document_model  # noqa: F401
import modules.documents.infrastructure.persistence.document_page_model  # noqa: F401
import modules.evidence.infrastructure.persistence.evidence_model  # noqa: F401
import modules.users.infrastructure.persistence.otp_model  # noqa: F401
import modules.users.infrastructure.persistence.user_model  # noqa: F401
import modules.verification.infrastructure.persistence.verification_model  # noqa: F401
import shared.infrastructure.rate_limit  # noqa: F401
from shared.infrastructure.database import Base
from tests.conftest import TEST_DATABASE_URL

PROJECT_ROOT = Path(__file__).resolve().parents[2]
MIGRATION_DB_URL = make_url(TEST_DATABASE_URL).set(
    database=f"{make_url(TEST_DATABASE_URL).database}_migrations"
)


async def _admin(sql: str) -> None:
    engine = create_async_engine(
        make_url(TEST_DATABASE_URL).set(database="postgres"), isolation_level="AUTOCOMMIT"
    )
    try:
        async with engine.connect() as conn:
            await conn.execute(text(sql))
    finally:
        await engine.dispose()


def _alembic(*args: str) -> subprocess.CompletedProcess[str]:
    env = {
        **os.environ,
        "PROOFLENS_DATABASE_URL": MIGRATION_DB_URL.render_as_string(hide_password=False),
    }
    return subprocess.run(
        [sys.executable, "-m", "alembic", *args],
        cwd=PROJECT_ROOT,
        env=env,
        capture_output=True,
        text=True,
        timeout=120,
    )


@pytest.fixture
async def migration_db():
    name = MIGRATION_DB_URL.database
    try:
        await _admin(f'DROP DATABASE IF EXISTS "{name}"')
        await _admin(f'CREATE DATABASE "{name}"')
    except Exception as e:  # pragma: no cover - depends on DB privileges
        pytest.skip(f"Cannot create a scratch database for migration tests: {e}")
    yield
    await _admin(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)')


async def test_migrations_upgrade_match_models_and_downgrade(migration_db):
    first = await asyncio.to_thread(_alembic, "upgrade", "722c7f3940dc")
    assert first.returncode == 0, first.stderr

    # Existing rows must survive later migrations (e.g. the NOT NULL processing_status backfill).
    engine = create_async_engine(MIGRATION_DB_URL)
    try:
        async with engine.begin() as conn:
            await conn.execute(text("INSERT INTO users VALUES ('u1', 'a@b.c', '', 'x', now())"))
            await conn.execute(text(
                "INSERT INTO documents (id, owner_id, filename, document_type, content, created_at) "
                "VALUES ('d1', 'u1', 'f.txt', 'text', 'hello', now())"
            ))

        upgrade = await asyncio.to_thread(_alembic, "upgrade", "head")
        assert upgrade.returncode == 0, upgrade.stderr

        async with engine.connect() as conn:
            status = await conn.scalar(text("SELECT processing_status FROM documents WHERE id = 'd1'"))
            assert status == "processed"
            drift = await conn.run_sync(
                lambda sync_conn: compare_metadata(MigrationContext.configure(sync_conn), Base.metadata)
            )
        assert drift == [], f"Models and migrations differ: {drift}"
    finally:
        await engine.dispose()

    downgrade = await asyncio.to_thread(_alembic, "downgrade", "base")
    assert downgrade.returncode == 0, downgrade.stderr
