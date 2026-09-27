import pytest
from httpx import ASGITransport, AsyncClient

from tests.integration.helpers import register


@pytest.fixture
async def registered_user(app):
    import uuid

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        email = f"error_test_{uuid.uuid4().hex[:8]}@example.com"
        return await register(client, email)


async def test_unauthenticated_get_claim(app):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        from uuid import uuid4
        response = await client.get(f"/api/v1/claims/{uuid4()}")
        assert response.status_code == 401


async def test_get_claim_not_found(app, registered_user):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        from uuid import uuid4
        headers = {"Authorization": f"Bearer {registered_user}"}
        response = await client.get(f"/api/v1/claims/{uuid4()}", headers=headers)
        assert response.status_code == 404
        data = response.json()
        assert data["error"] == "CLAIM_NOT_FOUND"


async def test_verify_nonexistent_claim(app, registered_user):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        from uuid import uuid4
        headers = {"Authorization": f"Bearer {registered_user}"}
        response = await client.post(
            "/api/v1/verification/",
            json={"claim_id": str(uuid4())},
            headers=headers,
        )
        assert response.status_code == 404
        data = response.json()
        assert data["error"] == "CLAIM_NOT_FOUND"


async def test_create_claim_empty_text(app, registered_user):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        headers = {"Authorization": f"Bearer {registered_user}"}
        response = await client.post(
            "/api/v1/claims/",
            json={"text": ""},
            headers=headers,
        )
        assert response.status_code == 422


async def test_get_document_not_found(app, registered_user):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        from uuid import uuid4
        headers = {"Authorization": f"Bearer {registered_user}"}
        response = await client.get(f"/api/v1/documents/{uuid4()}", headers=headers)
        assert response.status_code == 404
        data = response.json()
        assert data["error"] == "DOCUMENT_NOT_FOUND"


async def test_get_verification_not_found(app, registered_user):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        from uuid import uuid4
        headers = {"Authorization": f"Bearer {registered_user}"}
        response = await client.get(f"/api/v1/verification/{uuid4()}", headers=headers)
        assert response.status_code == 404
        data = response.json()
        assert data["error"] == "VERIFICATION_NOT_FOUND"


async def test_create_claim_invalid_json(app, registered_user):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        headers = {"Authorization": f"Bearer {registered_user}"}
        response = await client.post(
            "/api/v1/claims/",
            json={},
            headers=headers,
        )
        assert response.status_code == 422
