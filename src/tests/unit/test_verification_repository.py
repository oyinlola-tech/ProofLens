import uuid
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from modules.claims.infrastructure.persistence.claim_model import ClaimModel
from modules.users.infrastructure.persistence.user_model import UserModel
from modules.verification.domain.entities.verification import Verification
from modules.verification.domain.value_objects.confidence import Confidence
from modules.verification.domain.value_objects.verdict import Verdict
from modules.verification.domain.value_objects.verification_result import VerificationResult
from modules.verification.infrastructure.persistence.postgres_verification_repository import (
    PostgresVerificationRepository,
)


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


async def _create_claim(session: AsyncSession, owner_id: uuid.UUID | None = None) -> uuid.UUID:
    uid = owner_id or uuid4()
    await _create_test_user(session, uid)
    claim_id = uuid4()
    claim = ClaimModel(
        id=str(claim_id),
        owner_id=str(uid),
        text="Test claim for verification",
        status="pending",
    )
    session.add(claim)
    await session.flush()
    return claim_id


async def test_save_and_find_by_id(session: AsyncSession):
    claim_id = await _create_claim(session)
    repo = PostgresVerificationRepository(session)
    verification = Verification.create(claim_id=claim_id)
    result = VerificationResult(
        verdict=Verdict.SUPPORTED,
        confidence=Confidence(value=0.85),
        reasoning="Strong evidence",
    )
    verification.complete(result)
    await repo.save(verification)
    await session.commit()

    found = await repo.find_by_id(verification.id)
    assert found is not None
    assert found.id == verification.id
    assert found.result is not None
    assert found.result.verdict == Verdict.SUPPORTED


async def test_find_by_claim_id(session: AsyncSession):
    claim_id = await _create_claim(session)
    other_claim_id = await _create_claim(session)
    repo = PostgresVerificationRepository(session)
    v1 = Verification.create(claim_id=claim_id)
    v1.complete(
        VerificationResult(
            verdict=Verdict.SUPPORTED,
            confidence=Confidence(value=0.9),
            reasoning="Good",
        )
    )
    v2 = Verification.create(claim_id=claim_id)
    v2.complete(
        VerificationResult(
            verdict=Verdict.CONTRADICTED,
            confidence=Confidence(value=0.7),
            reasoning="Bad",
        )
    )
    v3 = Verification.create(claim_id=other_claim_id)
    v3.complete(
        VerificationResult(
            verdict=Verdict.SUPPORTED,
            confidence=Confidence(value=0.8),
            reasoning="Other",
        )
    )

    await repo.save(v1)
    await repo.save(v2)
    await repo.save(v3)
    await session.commit()

    found = await repo.find_by_claim_id(claim_id)
    assert len(found) == 2


async def test_find_by_id_not_found(session: AsyncSession):
    repo = PostgresVerificationRepository(session)
    found = await repo.find_by_id(uuid4())
    assert found is None


async def test_verification_complete_sets_completed_at():
    verification = Verification.create(claim_id=uuid4())
    assert verification.completed_at is None

    result = VerificationResult(
        verdict=Verdict.SUPPORTED,
        confidence=Confidence(value=0.9),
        reasoning="Test",
    )
    verification.complete(result)
    assert verification.completed_at is not None
