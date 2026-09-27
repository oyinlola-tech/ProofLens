from __future__ import annotations

import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from tests.conftest import _test_session_factory
from tests.fixtures.pdf_helpers import (
    create_invalid_pdf_bytes,
    create_multi_page_pdf,
    create_single_page_pdf,
    create_text_file_bytes,
)
from tests.integration.helpers import register


@pytest.fixture(autouse=True)
async def _clear_documents():
    async with _test_session_factory() as session:
        await session.execute(text("DELETE FROM document_pages"))
        await session.execute(text("DELETE FROM documents"))
        await session.commit()


@pytest.fixture
async def registered_user(app):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        email = f"doc_test_{uuid.uuid4().hex[:8]}@example.com"
        return await register(client, email)


async def test_upload_text_file(app, registered_user):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        headers = {"Authorization": f"Bearer {registered_user}"}
        file_data = create_text_file_bytes("Evidence content about earth being round.")

        resp = await client.post(
            "/api/v1/documents/upload",
            files={"file": ("test.txt", file_data, "text/plain")},
            headers=headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["filename"] == "test.txt"
        assert data["document_type"] == "text"
        assert data["processing_status"] == "processed"
        assert data["content_length"] > 0


async def test_upload_pdf_file(app, registered_user):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        headers = {"Authorization": f"Bearer {registered_user}"}
        file_data = create_single_page_pdf("Title", "Evidence content.")

        resp = await client.post(
            "/api/v1/documents/upload",
            files={"file": ("report.pdf", file_data, "application/pdf")},
            headers=headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["filename"] == "report.pdf"
        assert data["document_type"] == "pdf"
        assert data["processing_status"] == "processed"


async def test_upload_multi_page_pdf(app, registered_user):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        headers = {"Authorization": f"Bearer {registered_user}"}
        file_data = create_multi_page_pdf()

        resp = await client.post(
            "/api/v1/documents/upload",
            files={"file": ("multi.pdf", file_data, "application/pdf")},
            headers=headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        doc_id = data["id"]

        pages_resp = await client.get(f"/api/v1/documents/{doc_id}/pages", headers=headers)
        assert pages_resp.status_code == 200
        pages_data = pages_resp.json()
        assert pages_data["total_pages"] == 3
        assert pages_data["pages"][0]["page_number"] == 1
        assert pages_data["pages"][1]["page_number"] == 2
        assert pages_data["pages"][2]["page_number"] == 3


async def test_extracted_page_text_correct(app, registered_user):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        headers = {"Authorization": f"Bearer {registered_user}"}
        pages = [
            {"title": "Page One", "body": "First page evidence content."},
            {"title": "Page Two", "body": "Second page evidence content."},
        ]
        file_data = create_multi_page_pdf(pages)

        resp = await client.post(
            "/api/v1/documents/upload",
            files={"file": ("evidence.pdf", file_data, "application/pdf")},
            headers=headers,
        )
        doc_id = resp.json()["id"]

        pages_resp = await client.get(f"/api/v1/documents/{doc_id}/pages", headers=headers)
        pages_data = pages_resp.json()
        assert "Page One" in pages_data["pages"][0]["text"]
        assert "First page" in pages_data["pages"][0]["text"]
        assert "Page Two" in pages_data["pages"][1]["text"]
        assert "Second page" in pages_data["pages"][1]["text"]


async def test_invalid_pdf_rejected(app, registered_user):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        headers = {"Authorization": f"Bearer {registered_user}"}
        file_data = create_invalid_pdf_bytes()

        resp = await client.post(
            "/api/v1/documents/upload",
            files={"file": ("fake.pdf", file_data, "application/pdf")},
            headers=headers,
        )
        assert resp.status_code == 422


async def test_empty_file_rejected(app, registered_user):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        headers = {"Authorization": f"Bearer {registered_user}"}

        resp = await client.post(
            "/api/v1/documents/upload",
            files={"file": ("empty.pdf", b"", "application/pdf")},
            headers=headers,
        )
        assert resp.status_code == 422


async def test_document_pages_retrieval(app, registered_user):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        headers = {"Authorization": f"Bearer {registered_user}"}
        file_data = create_single_page_pdf("Test", "Page content here.")

        resp = await client.post(
            "/api/v1/documents/upload",
            files={"file": ("test.pdf", file_data, "application/pdf")},
            headers=headers,
        )
        doc_id = resp.json()["id"]

        pages_resp = await client.get(f"/api/v1/documents/{doc_id}/pages", headers=headers)
        assert pages_resp.status_code == 200
        data = pages_resp.json()
        assert data["document_id"] == doc_id
        assert data["total_pages"] == 1
        assert len(data["pages"]) == 1
        assert data["pages"][0]["page_number"] == 1
        assert data["pages"][0]["char_length"] > 0


async def test_document_with_metadata(app, registered_user):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        headers = {"Authorization": f"Bearer {registered_user}"}
        from tests.fixtures.pdf_helpers import create_pdf_with_metadata

        file_data = create_pdf_with_metadata(title="Meta Title", author="Author Name")

        resp = await client.post(
            "/api/v1/documents/upload",
            files={"file": ("meta.pdf", file_data, "application/pdf")},
            headers=headers,
        )
        assert resp.status_code == 201
        assert resp.json()["processing_status"] == "processed"


async def test_document_ownership_enforced(app):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        token1 = await register(client, "docowner1@test.com", "securepass1")
        headers1 = {"Authorization": f"Bearer {token1}"}

        token2 = await register(client, "docowner2@test.com", "securepass2")
        headers2 = {"Authorization": f"Bearer {token2}"}

        file_data = create_single_page_pdf("Private Doc", "Private content.")

        resp1 = await client.post(
            "/api/v1/documents/upload",
            files={"file": ("private.pdf", file_data, "application/pdf")},
            headers=headers1,
        )
        assert resp1.status_code == 201
        doc_id = resp1.json()["id"]

        resp2 = await client.get(f"/api/v1/documents/{doc_id}", headers=headers2)
        assert resp2.status_code == 404

        pages_resp = await client.get(f"/api/v1/documents/{doc_id}/pages", headers=headers2)
        assert pages_resp.status_code == 404


async def test_document_list_only_shows_own(app):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        token1 = await register(client, "listowner1@test.com", "securepass1")
        headers1 = {"Authorization": f"Bearer {token1}"}

        token2 = await register(client, "listowner2@test.com", "securepass2")
        headers2 = {"Authorization": f"Bearer {token2}"}

        file_data = create_text_file_bytes("User 1 document.")

        await client.post(
            "/api/v1/documents/upload",
            files={"file": ("user1.txt", file_data, "text/plain")},
            headers=headers1,
        )

        list1 = await client.get("/api/v1/documents/", headers=headers1)
        list2 = await client.get("/api/v1/documents/", headers=headers2)

        assert len(list1.json()) == 1
        assert len(list2.json()) == 0


async def test_upload_requires_auth(app):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        file_data = create_text_file_bytes("No auth content.")

        resp = await client.post(
            "/api/v1/documents/upload",
            files={"file": ("test.txt", file_data, "text/plain")},
        )
        assert resp.status_code == 401


async def test_pages_requires_auth(app):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        from uuid import uuid4

        resp = await client.get(f"/api/v1/documents/{uuid4()}/pages")
        assert resp.status_code == 401


async def test_pages_not_found(app, registered_user):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        from uuid import uuid4

        headers = {"Authorization": f"Bearer {registered_user}"}
        resp = await client.get(f"/api/v1/documents/{uuid4()}/pages", headers=headers)
        assert resp.status_code == 404


async def test_document_get_shows_processing_status(app, registered_user):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        headers = {"Authorization": f"Bearer {registered_user}"}
        file_data = create_text_file_bytes("Status check.")

        resp = await client.post(
            "/api/v1/documents/upload",
            files={"file": ("status.txt", file_data, "text/plain")},
            headers=headers,
        )
        doc_id = resp.json()["id"]

        get_resp = await client.get(f"/api/v1/documents/{doc_id}", headers=headers)
        assert get_resp.json()["processing_status"] == "processed"


async def test_list_documents_shows_processing_status(app, registered_user):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        headers = {"Authorization": f"Bearer {registered_user}"}
        file_data = create_text_file_bytes("List check.")

        await client.post(
            "/api/v1/documents/upload",
            files={"file": ("list.txt", file_data, "text/plain")},
            headers=headers,
        )

        resp = await client.get("/api/v1/documents/", headers=headers)
        assert len(resp.json()) == 1
        assert resp.json()[0]["processing_status"] == "processed"


async def test_existing_text_content_endpoint_still_works(app, registered_user):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        headers = {"Authorization": f"Bearer {registered_user}"}
        resp = await client.post(
            "/api/v1/documents/",
            json={
                "filename": "inline.txt",
                "content": "Inline text content for backward compatibility.",
                "document_type": "text",
            },
            headers=headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["filename"] == "inline.txt"
        assert data["content_length"] > 0
        assert "processing_status" in data
