import uuid
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from modules.claims.application.commands.create_claim import CreateClaim, CreateClaimHandler
from modules.claims.infrastructure.persistence.postgres_claim_repository import (
    PostgresClaimRepository,
)
from modules.documents.infrastructure.persistence.document_model import DocumentModel
from modules.evidence.application.commands.extract_evidence import (
    ExtractEvidence,
    ExtractEvidenceHandler,
)
from modules.evidence.domain.value_objects.source_reference import SourceReference
from modules.evidence.infrastructure.persistence.postgres_evidence_repository import (
    PostgresEvidenceRepository,
)
from modules.users.infrastructure.persistence.user_model import UserModel
from modules.verification.application.commands.verify_claim import (
    VerifyClaim,
    VerifyClaimHandler,
)
from modules.verification.domain.value_objects.verdict import Verdict
from modules.verification.infrastructure.persistence.postgres_verification_repository import (
    PostgresVerificationRepository,
)
from modules.verification.infrastructure.rules.rule_based_engine import (
    RuleBasedVerificationEngine,
)
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


async def _create_document(session: AsyncSession, owner_id: uuid.UUID, doc_id: str = "doc-001") -> str:
    doc = DocumentModel(
        id=doc_id,
        owner_id=str(owner_id),
        filename="test.pdf",
        document_type="text",
        content="Test document content",
    )
    session.add(doc)
    await session.flush()
    return doc.id


async def test_verify_claim_full_flow(session: AsyncSession):
    owner_id = await _create_test_user(session)
    claim_repo = PostgresClaimRepository(session)
    evidence_repo = PostgresEvidenceRepository(session)
    verification_repo = PostgresVerificationRepository(session)
    engine = RuleBasedVerificationEngine()

    create_handler = CreateClaimHandler(repository=claim_repo)
    extract_handler = ExtractEvidenceHandler(repository=evidence_repo)
    verify_handler = VerifyClaimHandler(
        engine=engine,
        claim_repository=claim_repo,
        evidence_repository=evidence_repo,
        verification_repository=verification_repo,
    )

    claim = await create_handler.handle(CreateClaim(text="The earth is round", owner_id=owner_id))
    await session.commit()

    doc_id = await _create_document(session, owner_id, "doc-001")
    await session.commit()

    source = SourceReference(document_id=doc_id, section="Science", page=1)
    await extract_handler.handle(
        ExtractEvidence(
            claim_id=claim.id,
            content="The earth is indeed round according to NASA",
            document_id=doc_id,
            source=source,
        )
    )
    await session.commit()

    result = await verify_handler.handle(VerifyClaim(claim_id=claim.id, owner_id=owner_id))
    await session.commit()

    assert result.verification.result is not None
    assert result.verification.result.verdict == Verdict.SUPPORTED
    assert result.verification.result.confidence.value > 0.0
    assert len(result.evidence_used) == 1
    assert result.evidence_used[0].source is not None
    assert result.evidence_used[0].source.document_id == doc_id
    assert result.claim_text == "The earth is round"

    persisted = await verification_repo.find_by_id(result.verification.id)
    assert persisted is not None
    assert persisted.result is not None

    updated_claim = await claim_repo.find_by_id(claim.id, owner_id=owner_id)
    assert updated_claim is not None
    from modules.claims.domain.value_objects.claim_status import ClaimStatus

    assert updated_claim.status == ClaimStatus.VERIFIED


async def test_verify_claim_not_found(session: AsyncSession):
    owner_id = await _create_test_user(session)
    claim_repo = PostgresClaimRepository(session)
    evidence_repo = PostgresEvidenceRepository(session)
    verification_repo = PostgresVerificationRepository(session)
    engine = RuleBasedVerificationEngine()

    handler = VerifyClaimHandler(
        engine=engine,
        claim_repository=claim_repo,
        evidence_repository=evidence_repo,
        verification_repository=verification_repo,
    )

    with pytest.raises(ClaimNotFoundError):
        await handler.handle(VerifyClaim(claim_id=uuid4(), owner_id=owner_id))


async def test_verify_claim_with_no_evidence(session: AsyncSession):
    owner_id = await _create_test_user(session)
    claim_repo = PostgresClaimRepository(session)
    evidence_repo = PostgresEvidenceRepository(session)
    verification_repo = PostgresVerificationRepository(session)
    engine = RuleBasedVerificationEngine()

    create_handler = CreateClaimHandler(repository=claim_repo)
    verify_handler = VerifyClaimHandler(
        engine=engine,
        claim_repository=claim_repo,
        evidence_repository=evidence_repo,
        verification_repository=verification_repo,
    )

    claim = await create_handler.handle(CreateClaim(text="The earth is round", owner_id=owner_id))
    await session.commit()

    result = await verify_handler.handle(VerifyClaim(claim_id=claim.id, owner_id=owner_id))
    await session.commit()

    assert result.verification.result is not None
    assert result.verification.result.verdict == Verdict.INSUFFICIENT_EVIDENCE
    assert len(result.evidence_used) == 0

    updated_claim = await claim_repo.find_by_id(claim.id, owner_id=owner_id)
    assert updated_claim is not None
    from modules.claims.domain.value_objects.claim_status import ClaimStatus

    assert updated_claim.status == ClaimStatus.UNVERIFIED


async def _verify_with_evidence(
    session: AsyncSession, claim_text: str, evidence_text: str, doc_id: str
):
    owner_id = await _create_test_user(session)
    claim_repo = PostgresClaimRepository(session)
    evidence_repo = PostgresEvidenceRepository(session)
    verify_handler = VerifyClaimHandler(
        engine=RuleBasedVerificationEngine(),
        claim_repository=claim_repo,
        evidence_repository=evidence_repo,
        verification_repository=PostgresVerificationRepository(session),
    )

    claim = await CreateClaimHandler(repository=claim_repo).handle(
        CreateClaim(text=claim_text, owner_id=owner_id)
    )
    doc_id = await _create_document(session, owner_id, doc_id)
    await ExtractEvidenceHandler(repository=evidence_repo).handle(
        ExtractEvidence(claim_id=claim.id, content=evidence_text, document_id=doc_id)
    )
    await session.commit()

    result = await verify_handler.handle(VerifyClaim(claim_id=claim.id, owner_id=owner_id))
    await session.commit()
    updated_claim = await claim_repo.find_by_id(claim.id, owner_id=owner_id)
    assert updated_claim is not None
    return result, updated_claim


async def test_verify_claim_contradicted_marks_rejected(session: AsyncSession):
    from modules.claims.domain.value_objects.claim_status import ClaimStatus

    result, claim = await _verify_with_evidence(
        session,
        "The drug is safe",
        "Regulators concluded the drug is not safe for children.",
        "doc-003",
    )
    assert result.verification.result is not None
    assert result.verification.result.verdict == Verdict.CONTRADICTED
    assert claim.status == ClaimStatus.REJECTED


async def test_verify_claim_does_not_use_another_owners_evidence(session: AsyncSession):
    from modules.evidence.domain.entities.evidence import Evidence

    result, claim = await _verify_with_evidence(
        session, "The earth is round", "The earth is round", "doc-004"
    )
    evidence_repo = PostgresEvidenceRepository(session)
    other_owner = await _create_test_user(session)
    await session.commit()

    assert await evidence_repo.find_by_claim_id(claim.id, owner_id=other_owner) == []
    ids = [e.id for e in result.evidence_used]
    assert await evidence_repo.find_by_ids(ids, owner_id=other_owner) == []
    found: list[Evidence] = await evidence_repo.find_by_ids(ids, owner_id=claim.owner_id)
    assert [e.id for e in found] == ids


async def test_verify_claim_irrelevant_evidence_is_unverified(session: AsyncSession):
    owner_id = await _create_test_user(session)
    claim_repo = PostgresClaimRepository(session)
    evidence_repo = PostgresEvidenceRepository(session)
    verification_repo = PostgresVerificationRepository(session)
    engine = RuleBasedVerificationEngine()

    create_handler = CreateClaimHandler(repository=claim_repo)
    extract_handler = ExtractEvidenceHandler(repository=evidence_repo)
    verify_handler = VerifyClaimHandler(
        engine=engine,
        claim_repository=claim_repo,
        evidence_repository=evidence_repo,
        verification_repository=verification_repo,
    )

    claim = await create_handler.handle(
        CreateClaim(text="Quantum physics explains subatomic particles", owner_id=owner_id)
    )
    await session.commit()

    doc_id = await _create_document(session, owner_id, "doc-002")
    await session.commit()

    await extract_handler.handle(
        ExtractEvidence(
            claim_id=claim.id,
            content="Basketball players score points in games",
            document_id=doc_id,
        )
    )
    await session.commit()

    result = await verify_handler.handle(VerifyClaim(claim_id=claim.id, owner_id=owner_id))
    await session.commit()

    assert result.verification.result is not None
    assert result.verification.result.verdict == Verdict.INSUFFICIENT_EVIDENCE

    updated_claim = await claim_repo.find_by_id(claim.id, owner_id=owner_id)
    assert updated_claim is not None
    from modules.claims.domain.value_objects.claim_status import ClaimStatus

    assert updated_claim.status == ClaimStatus.UNVERIFIED
