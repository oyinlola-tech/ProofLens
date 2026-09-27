import uuid
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from modules.claims.infrastructure.persistence.claim_model import ClaimModel
from modules.documents.infrastructure.persistence.document_model import DocumentModel
from modules.evidence.domain.entities.evidence import Evidence
from modules.evidence.domain.value_objects.source_reference import SourceReference
from modules.evidence.infrastructure.persistence.postgres_evidence_repository import (
    PostgresEvidenceRepository,
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


async def _create_claim(session: AsyncSession, owner_id: uuid.UUID | None = None) -> uuid.UUID:
    uid = owner_id or uuid4()
    await _create_test_user(session, uid)
    claim_id = uuid4()
    claim = ClaimModel(
        id=str(claim_id),
        owner_id=str(uid),
        text="Test claim for evidence",
        status="pending",
    )
    session.add(claim)
    await session.flush()
    return claim_id


async def _create_document(session: AsyncSession, doc_id: str, owner_id: uuid.UUID | None = None) -> str:
    uid = owner_id or uuid4()
    await _create_test_user(session, uid)
    doc = DocumentModel(
        id=doc_id,
        owner_id=str(uid),
        filename="test.pdf",
        document_type="text",
        content="Test document content",
    )
    session.add(doc)
    await session.flush()
    return doc.id


async def test_save_and_find_by_id(session: AsyncSession):
    claim_id = await _create_claim(session)
    repo = PostgresEvidenceRepository(session)
    evidence = Evidence.create(
        claim_id=claim_id,
        content="Test evidence",
    )
    await repo.save(evidence)
    await session.commit()

    found = await repo.find_by_id(evidence.id)
    assert found is not None
    assert found.id == evidence.id
    assert found.content == "Test evidence"


async def test_find_by_claim_id(session: AsyncSession):
    claim_id = await _create_claim(session)
    other_claim_id = await _create_claim(session)
    repo = PostgresEvidenceRepository(session)
    evidence1 = Evidence.create(claim_id=claim_id, content="Evidence 1")
    evidence2 = Evidence.create(claim_id=claim_id, content="Evidence 2")
    evidence3 = Evidence.create(claim_id=other_claim_id, content="Evidence 3")

    await repo.save(evidence1)
    await repo.save(evidence2)
    await repo.save(evidence3)
    await session.commit()

    found = await repo.find_by_claim_id(claim_id)
    assert len(found) == 2
    assert all(e.claim_id == claim_id for e in found)


async def test_find_by_claim_id_empty(session: AsyncSession):
    repo = PostgresEvidenceRepository(session)
    found = await repo.find_by_claim_id(uuid4())
    assert found == []


async def test_evidence_with_source(session: AsyncSession):
    claim_id = await _create_claim(session)
    doc_id = await _create_document(session, "doc-123")
    repo = PostgresEvidenceRepository(session)
    source = SourceReference(document_id=doc_id, section="Intro", page=1)
    evidence = Evidence.create(
        claim_id=claim_id,
        content="Test evidence with source",
        source=source,
    )
    await repo.save(evidence)
    await session.commit()

    found = await repo.find_by_id(evidence.id)
    assert found is not None
    assert found.source is not None
    assert found.source.section == "Intro"
    assert found.source.page == 1
