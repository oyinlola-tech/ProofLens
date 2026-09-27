from __future__ import annotations

from urllib.parse import urlparse

import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.settings import settings

PRODUCTION_INDICATORS = {"production", "prod", "live", "main", "master"}


def _get_test_database_url() -> str:
    url = settings.TEST_DATABASE_URL
    if not url:
        raise RuntimeError(
            "PROOFLENS_TEST_DATABASE_URL is not set. "
            "Tests must not run against the application database. "
            "Set PROOFLENS_TEST_DATABASE_URL in your environment or .env file."
        )

    parsed = urlparse(url)
    db_name = (parsed.path or "").lstrip("/").lower()

    if not db_name:
        raise RuntimeError("Test database URL has no database name.")

    for indicator in PRODUCTION_INDICATORS:
        if indicator in db_name:
            raise RuntimeError(
                f"Test database name '{db_name}' contains production indicator '{indicator}'. "
                "Tests must use a dedicated test database."
            )

    app_db_name = urlparse(settings.DATABASE_URL).path.lstrip("/").lower()
    if db_name == app_db_name:
        raise RuntimeError(
            f"Test database '{db_name}' is the same as the application database. "
            "Use a different database name for tests."
        )

    return url


TEST_DATABASE_URL = _get_test_database_url()

_test_engine = create_async_engine(
    TEST_DATABASE_URL,
    echo=False,
    pool_size=5,
    max_overflow=5,
    pool_pre_ping=True,
)

_test_session_factory = async_sessionmaker(
    _test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


@pytest_asyncio.fixture(scope="session", loop_scope="session", autouse=True)
async def create_tables():
    import modules.claims.infrastructure.persistence.claim_model  # noqa: F401
    import modules.documents.infrastructure.persistence.document_model  # noqa: F401
    import modules.documents.infrastructure.persistence.document_page_model  # noqa: F401
    import modules.evidence.infrastructure.persistence.evidence_model  # noqa: F401
    import modules.users.infrastructure.persistence.otp_model  # noqa: F401
    import modules.users.infrastructure.persistence.user_model  # noqa: F401
    import modules.verification.infrastructure.persistence.verification_model  # noqa: F401
    from shared.infrastructure.database import Base
    from shared.infrastructure.rate_limit import RateLimitModel  # noqa: F401

    async with _test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with _test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await _test_engine.dispose()


@pytest_asyncio.fixture(loop_scope="session")
async def session():
    async with _test_session_factory() as sess:
        yield sess


@pytest_asyncio.fixture(loop_scope="session")
async def auth_tokens(session: AsyncSession):
    from datetime import UTC, datetime
    from uuid import uuid4

    from modules.users.infrastructure.persistence.user_model import AuthTokenModel, UserModel
    from shared.infrastructure.auth import generate_token, hash_password, hash_token

    password_hash = hash_password("testpassword123")
    user1 = UserModel(
        id=str(uuid4()),
        email="user1@test.com",
        password_salt="",  # Argon2id embeds salt in hash
        password_hash=password_hash,
    )
    user2 = UserModel(
        id=str(uuid4()),
        email="user2@test.com",
        password_salt="",
        password_hash=password_hash,
    )
    session.add(user1)
    session.add(user2)
    await session.flush()

    raw_token1 = generate_token()
    raw_token2 = generate_token()
    token1 = AuthTokenModel(
        id=str(uuid4()),
        user_id=user1.id,
        token_hash=hash_token(raw_token1),
        expires_at=datetime(2099, 1, 1, tzinfo=UTC),
    )
    token2 = AuthTokenModel(
        id=str(uuid4()),
        user_id=user2.id,
        token_hash=hash_token(raw_token2),
        expires_at=datetime(2099, 1, 1, tzinfo=UTC),
    )
    session.add(token1)
    session.add(token2)
    await session.flush()
    await session.commit()

    return {
        "user1_id": user1.id,
        "user2_id": user2.id,
        "token1": raw_token1,
        "token2": raw_token2,
    }
