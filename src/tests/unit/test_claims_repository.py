import uuid
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from modules.claims.domain.entities.claim import Claim
from modules.claims.domain.value_objects.claim_status import ClaimStatus
from modules.claims.domain.value_objects.claim_text import ClaimText
from modules.claims.infrastructure.persistence.postgres_claim_repository import (
    PostgresClaimRepository,
)
from modules.users.infrastructure.persistence.user_model import UserModel


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


async def test_save_and_find_by_id(session: AsyncSession):
    owner_id = await _create_test_user(session)
    repo = PostgresClaimRepository(session)
    claim = Claim.create(text=ClaimText(value="Test claim"), owner_id=owner_id)
    await repo.save(claim)
    await session.commit()

    found = await repo.find_by_id(claim.id, owner_id=owner_id)
    assert found is not None
    assert found.id == claim.id
    assert found.text.value == "Test claim"


async def test_find_by_id_not_found(session: AsyncSession):
    await _create_test_user(session)
    repo = PostgresClaimRepository(session)
    found = await repo.find_by_id(uuid4())
    assert found is None


async def test_find_all(session: AsyncSession):
    owner_id = await _create_test_user(session)
    repo = PostgresClaimRepository(session)
    claim1 = Claim.create(text=ClaimText(value="Claim one"), owner_id=owner_id)
    claim2 = Claim.create(text=ClaimText(value="Claim two"), owner_id=owner_id)
    await repo.save(claim1)
    await repo.save(claim2)
    await session.commit()

    all_claims = await repo.find_all(owner_id=owner_id)
    assert len(all_claims) >= 2


async def test_save_updates_existing(session: AsyncSession):
    owner_id = await _create_test_user(session)
    repo = PostgresClaimRepository(session)
    claim = Claim.create(text=ClaimText(value="Original"), owner_id=owner_id)
    await repo.save(claim)
    await session.commit()

    claim.mark_analyzing()
    await repo.save(claim)
    await session.commit()

    found = await repo.find_by_id(claim.id, owner_id=owner_id)
    assert found is not None
    assert found.status == ClaimStatus.ANALYZING


async def test_claim_lifecycle():
    claim = Claim.create(text=ClaimText(value="Test"), owner_id=uuid4())
    assert claim.status == ClaimStatus.PENDING

    claim.mark_analyzing()
    assert claim.status == ClaimStatus.ANALYZING

    claim.mark_verified()
    assert claim.status == ClaimStatus.VERIFIED


async def test_claim_rejected_lifecycle():
    claim = Claim.create(text=ClaimText(value="Test"), owner_id=uuid4())
    claim.mark_analyzing()
    claim.mark_rejected()
    assert claim.status == ClaimStatus.REJECTED


async def test_claim_failed_lifecycle():
    claim = Claim.create(text=ClaimText(value="Test"), owner_id=uuid4())
    claim.mark_analyzing()
    claim.mark_failed()
    assert claim.status == ClaimStatus.FAILED
