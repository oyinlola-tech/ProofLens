import uuid
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from modules.claims.application.commands.create_claim import CreateClaim, CreateClaimHandler
from modules.claims.application.queries.get_claim import GetClaim, GetClaimHandler
from modules.claims.domain.value_objects.claim_status import ClaimStatus
from modules.claims.domain.value_objects.claim_text import ClaimText
from modules.claims.infrastructure.persistence.postgres_claim_repository import (
    PostgresClaimRepository,
)
from modules.users.infrastructure.persistence.user_model import UserModel
from shared.errors.domain import ClaimNotFoundError

TEST_OWNER = uuid4()


async def _create_test_user(session: AsyncSession, user_id: uuid.UUID | None = None) -> uuid.UUID:
    uid = user_id or uuid4()
    user = UserModel(
        id=str(uid),
        email=f"test_{uid.hex[:8]}@test.com",
        password_salt="",
        password_hash="$argon2id$v=19$m=65536,t=3,p=4$test$test",
    )
    session.add(user)
    await session.flush()
    return uid


async def test_create_claim(session: AsyncSession):
    owner_id = await _create_test_user(session)
    repository = PostgresClaimRepository(session)
    handler = CreateClaimHandler(repository=repository)

    command = CreateClaim(text="The earth is round", owner_id=owner_id)
    claim = await handler.handle(command)
    await session.commit()

    assert claim.text.value == "The earth is round"
    assert claim.status == ClaimStatus.PENDING
    assert claim.id is not None


async def test_get_claim(session: AsyncSession):
    owner_id = await _create_test_user(session)
    repository = PostgresClaimRepository(session)
    create_handler = CreateClaimHandler(repository=repository)
    get_handler = GetClaimHandler(repository=repository)

    command = CreateClaim(text="Water boils at 100 degrees Celsius", owner_id=owner_id)
    claim = await create_handler.handle(command)
    await session.commit()

    query = GetClaim(claim_id=claim.id, owner_id=owner_id)
    found_claim = await get_handler.handle(query)

    assert found_claim.id == claim.id
    assert found_claim.text.value == "Water boils at 100 degrees Celsius"


async def test_get_claim_not_found(session: AsyncSession):
    owner_id = await _create_test_user(session)
    repository = PostgresClaimRepository(session)
    handler = GetClaimHandler(repository=repository)

    query = GetClaim(claim_id=uuid4(), owner_id=owner_id)

    with pytest.raises(ClaimNotFoundError):
        await handler.handle(query)


def test_claim_text_validation():
    with pytest.raises(ValueError):
        ClaimText(value="")

    with pytest.raises(ValueError):
        ClaimText(value="   ")

    valid = ClaimText(value="Valid claim text")
    assert valid.value == "Valid claim text"
