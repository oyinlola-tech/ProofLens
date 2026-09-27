import pytest
from httpx import ASGITransport, AsyncClient

from tests.integration.helpers import register


@pytest.fixture
async def registered_user(app):
    import uuid

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        return await register(client, email)


async def test_health_endpoint(app):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["service"] == "ProofLens"


async def test_unauthenticated_access_rejected(app):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/claims/",
            json={"text": "The earth is round"},
        )
        assert response.status_code == 401


async def test_create_claim_endpoint(app, registered_user):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        headers = {"Authorization": f"Bearer {registered_user}"}
        response = await client.post(
            "/api/v1/claims/",
            json={"text": "The earth is round"},
            headers=headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["text"] == "The earth is round"
        assert data["status"] == "pending"
        assert "id" in data


async def test_get_claim_endpoint(app, registered_user):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        headers = {"Authorization": f"Bearer {registered_user}"}
        create_resp = await client.post(
            "/api/v1/claims/",
            json={"text": "Water boils at 100 degrees"},
            headers=headers,
        )
        claim_id = create_resp.json()["id"]

        response = await client.get(f"/api/v1/claims/{claim_id}", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["text"] == "Water boils at 100 degrees"
        assert data["id"] == claim_id


async def test_create_document_endpoint(app, registered_user):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        headers = {"Authorization": f"Bearer {registered_user}"}
        response = await client.post(
            "/api/v1/documents/",
            json={
                "filename": "report.pdf",
                "content": "The earth is confirmed round by science.",
                "document_type": "text",
            },
            headers=headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["filename"] == "report.pdf"
        assert data["document_type"] == "text"
        assert data["content_length"] > 0


async def test_create_evidence_endpoint(app, registered_user):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        headers = {"Authorization": f"Bearer {registered_user}"}
        claim_resp = await client.post(
            "/api/v1/claims/",
            json={"text": "The earth is round"},
            headers=headers,
        )
        claim_id = claim_resp.json()["id"]

        doc_resp = await client.post(
            "/api/v1/documents/",
            json={"filename": "nasa.pdf", "content": "NASA data", "document_type": "text"},
            headers=headers,
        )
        doc_id = doc_resp.json()["id"]

        response = await client.post(
            "/api/v1/evidence/",
            json={
                "claim_id": claim_id,
                "content": "NASA confirms the earth is round",
                "document_id": doc_id,
            },
            headers=headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["content"] == "NASA confirms the earth is round"
        assert data["claim_id"] == claim_id


async def test_verify_claim_endpoint(app, registered_user):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        headers = {"Authorization": f"Bearer {registered_user}"}
        claim_resp = await client.post(
            "/api/v1/claims/",
            json={"text": "The earth is round"},
            headers=headers,
        )
        claim_id = claim_resp.json()["id"]

        doc_resp = await client.post(
            "/api/v1/documents/",
            json={"filename": "nasa.pdf", "content": "NASA data", "document_type": "text"},
            headers=headers,
        )
        doc_id = doc_resp.json()["id"]

        await client.post(
            "/api/v1/evidence/",
            json={
                "claim_id": claim_id,
                "content": "The earth is indeed round according to NASA",
                "document_id": doc_id,
            },
            headers=headers,
        )

        response = await client.post(
            "/api/v1/verification/",
            json={"claim_id": claim_id},
            headers=headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert "verdict" in data
        assert "confidence" in data
        assert data["claim_id"] == claim_id
        assert data["claim_text"] == "The earth is round"
        assert len(data["evidence_used"]) >= 1
        assert data["evidence_used"][0]["content"] == "The earth is indeed round according to NASA"


async def test_full_workflow(app, registered_user):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        headers = {"Authorization": f"Bearer {registered_user}"}
        doc_resp = await client.post(
            "/api/v1/documents/",
            json={
                "filename": "science_report.txt",
                "content": "Water boils at 100 degrees Celsius at sea level.",
                "document_type": "text",
            },
            headers=headers,
        )
        assert doc_resp.status_code == 201
        doc_id = doc_resp.json()["id"]

        claim_resp = await client.post(
            "/api/v1/claims/",
            json={"text": "Water boils at 100 degrees Celsius"},
            headers=headers,
        )
        assert claim_resp.status_code == 201
        claim_id = claim_resp.json()["id"]
        assert claim_resp.json()["status"] == "pending"

        evidence_resp = await client.post(
            "/api/v1/evidence/",
            json={
                "claim_id": claim_id,
                "content": "Water boils at 100 degrees Celsius at sea level.",
                "document_id": doc_id,
                "section": "Introduction",
                "page": 1,
            },
            headers=headers,
        )
        assert evidence_resp.status_code == 201
        evidence_id = evidence_resp.json()["id"]

        verification_resp = await client.post(
            "/api/v1/verification/",
            json={"claim_id": claim_id},
            headers=headers,
        )
        assert verification_resp.status_code == 201
        vdata = verification_resp.json()
        assert vdata["verdict"] == "supported"
        assert vdata["confidence"] > 0.0
        assert len(vdata["evidence_used"]) == 1
        assert vdata["evidence_used"][0]["id"] == evidence_id

        claim_status_resp = await client.get(f"/api/v1/claims/{claim_id}", headers=headers)
        assert claim_status_resp.status_code == 200
        assert claim_status_resp.json()["status"] == "verified"


async def test_ownership_isolation(app):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        token1 = await register(client, "owner1@test.com", "securepass1")
        headers1 = {"Authorization": f"Bearer {token1}"}

        token2 = await register(client, "owner2@test.com", "securepass2")
        headers2 = {"Authorization": f"Bearer {token2}"}

        claim_resp = await client.post(
            "/api/v1/claims/",
            json={"text": "User 1 claim"},
            headers=headers1,
        )
        claim_id = claim_resp.json()["id"]

        response = await client.get(f"/api/v1/claims/{claim_id}", headers=headers2)
        assert response.status_code == 404
