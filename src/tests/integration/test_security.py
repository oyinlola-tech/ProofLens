from __future__ import annotations

import uuid

from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from tests.conftest import _test_session_factory
from tests.integration.helpers import register


class TestAuthorization:
    async def test_user_a_cannot_read_user_b_evidence(self, app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            token_a = await register(client, f"a_{uuid.uuid4().hex[:8]}@test.com")
            token_b = await register(client, f"b_{uuid.uuid4().hex[:8]}@test.com")
            h_a = {"Authorization": f"Bearer {token_a}"}
            h_b = {"Authorization": f"Bearer {token_b}"}

            claim_b = await client.post("/api/v1/claims/", json={"text": "User B claim"}, headers=h_b)
            claim_b_id = claim_b.json()["id"]

            doc_b = await client.post(
                "/api/v1/documents/",
                json={"filename": "doc.pdf", "content": "User B document", "document_type": "text"},
                headers=h_b,
            )
            doc_b_id = doc_b.json()["id"]

            ev_b = await client.post(
                "/api/v1/evidence/",
                json={"claim_id": claim_b_id, "content": "B evidence", "document_id": doc_b_id},
                headers=h_b,
            )
            ev_b_id = ev_b.json()["id"]

            resp = await client.get(f"/api/v1/evidence/{ev_b_id}", headers=h_a)
            assert resp.status_code in (403, 404)

    async def test_user_a_cannot_access_user_b_claim(self, app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            token_a = await register(client, f"a_{uuid.uuid4().hex[:8]}@test.com")
            token_b = await register(client, f"b_{uuid.uuid4().hex[:8]}@test.com")
            h_a = {"Authorization": f"Bearer {token_a}"}
            h_b = {"Authorization": f"Bearer {token_b}"}

            claim_b = await client.post("/api/v1/claims/", json={"text": "User B claim"}, headers=h_b)
            claim_b_id = claim_b.json()["id"]

            resp = await client.get(f"/api/v1/claims/{claim_b_id}", headers=h_a)
            assert resp.status_code == 404

    async def test_user_a_cannot_access_user_b_document(self, app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            token_a = await register(client, f"a_{uuid.uuid4().hex[:8]}@test.com")
            token_b = await register(client, f"b_{uuid.uuid4().hex[:8]}@test.com")
            h_a = {"Authorization": f"Bearer {token_a}"}
            h_b = {"Authorization": f"Bearer {token_b}"}

            doc_b = await client.post(
                "/api/v1/documents/",
                json={"filename": "doc.pdf", "content": "User B doc", "document_type": "text"},
                headers=h_b,
            )
            doc_b_id = doc_b.json()["id"]

            resp = await client.get(f"/api/v1/documents/{doc_b_id}", headers=h_a)
            assert resp.status_code == 404

    async def test_user_a_cannot_verify_user_b_claim(self, app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            token_a = await register(client, f"a_{uuid.uuid4().hex[:8]}@test.com")
            token_b = await register(client, f"b_{uuid.uuid4().hex[:8]}@test.com")
            h_a = {"Authorization": f"Bearer {token_a}"}
            h_b = {"Authorization": f"Bearer {token_b}"}

            claim_b = await client.post("/api/v1/claims/", json={"text": "User B claim"}, headers=h_b)
            claim_b_id = claim_b.json()["id"]

            resp = await client.post("/api/v1/verification/", json={"claim_id": claim_b_id}, headers=h_a)
            assert resp.status_code == 404

    async def test_user_a_cannot_distinguish_user_b_pending_verification(self, app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            token_a = await register(client, f"a_{uuid.uuid4().hex[:8]}@test.com")
            h_a = {"Authorization": f"Bearer {token_a}"}

            fake_claim_id = str(uuid.uuid4())
            resp1 = await client.post(
                "/api/v1/verification/", json={"claim_id": fake_claim_id}, headers=h_a
            )
            assert resp1.status_code == 404


class TestTokens:
    async def test_valid_token_authenticates(self, app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            token = await register(client, f"tok_{uuid.uuid4().hex[:8]}@test.com")
            resp = await client.get("/api/v1/claims/", headers={"Authorization": f"Bearer {token}"})
            assert resp.status_code == 200

    async def test_revoked_token_fails(self, app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            token = await register(client, f"rev_{uuid.uuid4().hex[:8]}@test.com")
            h = {"Authorization": f"Bearer {token}"}

            await client.post("/api/v1/auth/logout", json={"token": token}, headers=h)

            resp = await client.get("/api/v1/claims/", headers={"Authorization": f"Bearer {token}"})
            assert resp.status_code == 401

    async def test_logout_invalidates_token(self, app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            token = await register(client, f"logout_{uuid.uuid4().hex[:8]}@test.com")
            h = {"Authorization": f"Bearer {token}"}

            resp = await client.post("/api/v1/auth/logout", json={"token": token}, headers=h)
            assert resp.status_code == 204

            resp = await client.get("/api/v1/claims/", headers=h)
            assert resp.status_code == 401

    async def test_revoke_all_invalidates_all_tokens(self, app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            email = f"ra_{uuid.uuid4().hex[:8]}@test.com"
            token1 = await register(client, email)
            h1 = {"Authorization": f"Bearer {token1}"}

            resp = await client.post("/api/v1/auth/login", json={
                "email": email, "password": "securepass123"
            })
            token2 = resp.json()["token"]
            h2 = {"Authorization": f"Bearer {token2}"}

            resp = await client.get("/api/v1/claims/", headers=h2)
            assert resp.status_code == 200

            await client.post("/api/v1/auth/revoke-all", headers=h1)

            resp = await client.get("/api/v1/claims/", headers=h1)
            assert resp.status_code == 401

            resp = await client.get("/api/v1/claims/", headers=h2)
            assert resp.status_code == 401

    async def test_session_cap_evicts_old_session(self, app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            email = f"cap_{uuid.uuid4().hex[:8]}@test.com"
            await register(client, email)
            tokens = []
            for _ in range(5):
                resp = await client.post("/api/v1/auth/login", json={"email": email, "password": "securepass123"})
                if resp.status_code == 200:
                    tokens.append(resp.json()["token"])

            assert len(tokens) == 5

            resp = await client.post("/api/v1/auth/login", json={"email": email, "password": "securepass123"})
            assert resp.status_code == 200

            h_oldest = {"Authorization": f"Bearer {tokens[0]}"}
            resp = await client.get("/api/v1/claims/", headers=h_oldest)
            assert resp.status_code == 401

    async def test_expired_token_fails(self, app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            email = f"exp_{uuid.uuid4().hex[:8]}@test.com"
            token = await register(client, email)

            async with _test_session_factory() as session:
                from shared.infrastructure.auth import hash_token
                await session.execute(
                    text("UPDATE auth_tokens SET expires_at = '2020-01-01T00:00:00Z' WHERE token_hash = :th"),
                    {"th": hash_token(token)},
                )
                await session.commit()

            resp = await client.get("/api/v1/claims/", headers={"Authorization": f"Bearer {token}"})
            assert resp.status_code == 401

    async def test_stored_token_contains_only_digest(self, app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            token = await register(client, f"digest_{uuid.uuid4().hex[:8]}@test.com")

            async with _test_session_factory() as session:
                result = await session.execute(text("SELECT token_hash FROM auth_tokens LIMIT 1"))
                row = result.first()
                assert row is not None
                assert row[0] != token
                assert len(row[0]) == 64


class TestPasswords:
    async def test_register_rejects_short_password(self, app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/api/v1/auth/register",
                json={"email": f"short_{uuid.uuid4().hex[:8]}@test.com", "password": "short"},
            )
            assert resp.status_code == 422

    async def test_register_rejects_long_password(self, app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/api/v1/auth/register",
                json={"email": f"long_{uuid.uuid4().hex[:8]}@test.com", "password": "x" * 129},
            )
            assert resp.status_code == 422

    async def test_login_rejects_long_password(self, app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/api/v1/auth/login",
                json={"email": f"long_{uuid.uuid4().hex[:8]}@test.com", "password": "x" * 129},
            )
            assert resp.status_code == 422

    async def test_argon2id_password_authenticates(self, app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            email = f"argon_{uuid.uuid4().hex[:8]}@test.com"
            await register(client, email)
            resp = await client.post("/api/v1/auth/login", json={"email": email, "password": "securepass123"})
            assert resp.status_code == 200

    async def test_legacy_pbkdf2_password_authenticates(self, app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            email = f"pbkdf2_{uuid.uuid4().hex[:8]}@test.com"
            user_id = str(uuid.uuid4())
            password = "legacy_pass_123"
            salt = "a" * 32
            salt_bytes = bytes.fromhex(salt)
            import hashlib as hl
            pw_hash = hl.pbkdf2_hmac("sha256", password.encode(), salt_bytes, 600000, 32).hex()

            async with _test_session_factory() as session:
                await session.execute(
                    text(
                        "INSERT INTO users (id, email, password_salt, password_hash, created_at, email_verified_at) "
                        "VALUES (:id, :email, :salt, :hash, now(), now())"
                    ),
                    {"id": user_id, "email": email, "salt": salt, "hash": pw_hash},
                )
                await session.commit()

            resp = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
            assert resp.status_code == 200

            async with _test_session_factory() as session:
                result = await session.execute(
                    text("SELECT password_salt, password_hash FROM users WHERE id = :id"),
                    {"id": user_id},
                )
                row = result.first()
                assert row is not None
                assert row[0] == ""
                assert row[1].startswith("$argon2")

    async def test_historical_100k_pbkdf2_password_authenticates(self, app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            email = f"pbkdf2_100k_{uuid.uuid4().hex[:8]}@test.com"
            user_id = str(uuid.uuid4())
            password = "historical_pass_456"
            salt = "b" * 32
            salt_bytes = bytes.fromhex(salt)
            import hashlib as hl
            pw_hash = hl.pbkdf2_hmac("sha256", password.encode(), salt_bytes, 100000, 32).hex()

            async with _test_session_factory() as session:
                await session.execute(
                    text(
                        "INSERT INTO users (id, email, password_salt, password_hash, created_at, email_verified_at) "
                        "VALUES (:id, :email, :salt, :hash, now(), now())"
                    ),
                    {"id": user_id, "email": email, "salt": salt, "hash": pw_hash},
                )
                await session.commit()

            resp = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
            assert resp.status_code == 200

            async with _test_session_factory() as session:
                result = await session.execute(
                    text("SELECT password_salt, password_hash FROM users WHERE id = :id"),
                    {"id": user_id},
                )
                row = result.first()
                assert row is not None
                assert row[0] == ""
                assert row[1].startswith("$argon2")

    async def test_wrong_password_rejected(self, app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            email = f"wrong_{uuid.uuid4().hex[:8]}@test.com"
            await register(client, email, "correct_password")
            resp = await client.post("/api/v1/auth/login", json={"email": email, "password": "wrong_password"})
            assert resp.status_code == 401


class TestRateLimiting:
    async def test_repeated_failed_logins_trigger_limit(self, app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            email = f"rl_{uuid.uuid4().hex[:8]}@test.com"
            for _ in range(5):
                await client.post("/api/v1/auth/login", json={"email": email, "password": "wrongpass"})

            resp = await client.post("/api/v1/auth/login", json={"email": email, "password": "wrongpass"})
            assert resp.status_code == 429

    async def test_registration_rate_limiting(self, app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            for i in range(10):
                await client.post(
                    "/api/v1/auth/register",
                    json={"email": f"reg_rl_{i}_{uuid.uuid4().hex[:8]}@test.com", "password": "securepass123"},
                )

            resp = await client.post(
                "/api/v1/auth/register",
                json={"email": f"reg_rl_final_{uuid.uuid4().hex[:8]}@test.com", "password": "securepass123"},
            )
            assert resp.status_code == 429

    async def test_concurrent_rate_limit_enforcement(self, app):
        import asyncio
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            email = f"concurrent_{uuid.uuid4().hex[:8]}@test.com"
            results = []

            async def attempt_login():
                resp = await client.post("/api/v1/auth/login", json={"email": email, "password": "wrongpass"})
                results.append(resp.status_code)

            tasks = [attempt_login() for _ in range(10)]
            await asyncio.gather(*tasks)

            rate_limited = sum(1 for code in results if code == 429)
            allowed_failures = sum(1 for code in results if code == 401)
            assert rate_limited > 0, "Rate limiting should have triggered for concurrent attempts"
            assert allowed_failures <= 5, f"Too many failures allowed: {allowed_failures}"

    async def test_new_window_allows_attempts(self, app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            email = f"window_{uuid.uuid4().hex[:8]}@test.com"
            for _ in range(5):
                await client.post("/api/v1/auth/login", json={"email": email, "password": "wrongpass"})

            resp = await client.post("/api/v1/auth/login", json={"email": email, "password": "wrongpass"})
            assert resp.status_code == 429

            async with _test_session_factory() as session:
                await session.execute(text("DELETE FROM rate_limits"))
                await session.commit()

            resp = await client.post("/api/v1/auth/login", json={"email": email, "password": "wrongpass"})
            assert resp.status_code == 401

    async def test_successful_login_not_affected_by_rate_limit(self, app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            email = f"success_{uuid.uuid4().hex[:8]}@test.com"
            await register(client, email)

            for _ in range(4):
                await client.post("/api/v1/auth/login", json={"email": email, "password": "wrongpass"})

            resp = await client.post("/api/v1/auth/login", json={"email": email, "password": "securepass123"})
            assert resp.status_code == 200

    async def test_rate_limit_db_failure_fails_closed(self, app):
        from unittest.mock import AsyncMock, patch

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            email = f"dbfail_{uuid.uuid4().hex[:8]}@test.com"
            await register(client, email)

            with patch(
                "modules.users.presentation.http.routes.is_login_rate_limited",
                new_callable=AsyncMock,
                side_effect=Exception("Database unavailable"),
            ):
                resp = await client.post("/api/v1/auth/login", json={"email": email, "password": "wrongpass"})
                assert resp.status_code == 503


class TestRequestSize:
    async def test_oversized_content_length_rejected(self, app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            token = await register(client, f"size_{uuid.uuid4().hex[:8]}@test.com")
            resp = await client.post(
                "/api/v1/claims/",
                json={"text": "test"},
                headers={"Authorization": f"Bearer {token}", "Content-Length": "999999999"},
            )
            assert resp.status_code == 413

    async def test_invalid_content_length_rejected(self, app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            token = await register(client, f"cl_{uuid.uuid4().hex[:8]}@test.com")
            resp = await client.post(
                "/api/v1/claims/",
                json={"text": "test"},
                headers={"Authorization": f"Bearer {token}", "Content-Length": "not-a-number"},
            )
            assert resp.status_code == 400

    async def test_document_endpoint_allows_large_content(self, app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            token = await register(client, f"docsize_{uuid.uuid4().hex[:8]}@test.com")
            h = {"Authorization": f"Bearer {token}"}
            large_content = "x" * 2_000_000
            resp = await client.post(
                "/api/v1/documents/",
                json={"filename": "big.txt", "content": large_content, "document_type": "text"},
                headers=h,
            )
            assert resp.status_code == 201

    async def test_oversized_document_rejected(self, app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            token = await register(client, f"docsize_{uuid.uuid4().hex[:8]}@test.com")
            h = {"Authorization": f"Bearer {token}"}
            large_content = "x" * 11_000_000
            resp = await client.post(
                "/api/v1/documents/",
                json={"filename": "big.txt", "content": large_content, "document_type": "text"},
                headers=h,
            )
            assert resp.status_code == 413

    async def test_chunked_oversized_request_rejected(self, app):
        async def body():
            for _ in range(20):
                yield b"x" * 100_000

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            token = await register(client, f"chunk_{uuid.uuid4().hex[:8]}@test.com")
            resp = await client.post(
                "/api/v1/claims/",
                content=body(),
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            )
            assert "content-length" not in {k.lower() for k in resp.request.headers}
            assert resp.status_code == 413

    async def test_normal_request_still_works(self, app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            token = await register(client, f"normal_{uuid.uuid4().hex[:8]}@test.com")
            resp = await client.post(
                "/api/v1/claims/",
                json={"text": "Normal sized claim"},
                headers={"Authorization": f"Bearer {token}"},
            )
            assert resp.status_code == 201


class TestEvidenceLifecycle:
    async def test_evidence_used_in_verification_cannot_be_deleted(self, app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            token = await register(client, f"ev_{uuid.uuid4().hex[:8]}@test.com")
            h = {"Authorization": f"Bearer {token}"}

            claim = await client.post("/api/v1/claims/", json={"text": "Test claim"}, headers=h)
            claim_id = claim.json()["id"]

            doc = await client.post(
                "/api/v1/documents/",
                json={"filename": "test.pdf", "content": "Test doc", "document_type": "text"},
                headers=h,
            )
            doc_id = doc.json()["id"]

            ev = await client.post(
                "/api/v1/evidence/",
                json={"claim_id": claim_id, "content": "Evidence", "document_id": doc_id},
                headers=h,
            )
            ev_id = ev.json()["id"]

            await client.post(
                "/api/v1/verification/", json={"claim_id": claim_id}, headers=h
            )

            resp = await client.delete(f"/api/v1/evidence/{ev_id}", headers=h)
            assert resp.status_code == 409

    async def test_verification_remains_readable_after_failed_delete(self, app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            token = await register(client, f"vrd_{uuid.uuid4().hex[:8]}@test.com")
            h = {"Authorization": f"Bearer {token}"}

            claim = await client.post("/api/v1/claims/", json={"text": "Readable claim"}, headers=h)
            claim_id = claim.json()["id"]

            doc = await client.post(
                "/api/v1/documents/",
                json={"filename": "test.pdf", "content": "Test doc", "document_type": "text"},
                headers=h,
            )
            doc_id = doc.json()["id"]

            await client.post(
                "/api/v1/evidence/",
                json={"claim_id": claim_id, "content": "Evidence", "document_id": doc_id},
                headers=h,
            )

            v_resp = await client.post(
                "/api/v1/verification/", json={"claim_id": claim_id}, headers=h
            )
            v_id = v_resp.json()["id"]

            ev_resp = await client.get(f"/api/v1/verification/{v_id}", headers=h)
            assert ev_resp.status_code == 200
            assert len(ev_resp.json()["evidence_used"]) >= 1


class TestRateLimitPersistence:
    """Regression tests: these run against the production get_session."""

    async def test_failed_logins_are_persisted(self, app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            email = f"persist_{uuid.uuid4().hex[:8]}@test.com"
            await register(client, email)
            for _ in range(3):
                resp = await client.post("/api/v1/auth/login", json={"email": email, "password": "wrong-pass"})
                assert resp.status_code == 401

        async with _test_session_factory() as session:
            result = await session.execute(
                text("SELECT attempts FROM rate_limits WHERE key LIKE :k"), {"k": f"login:{email}:%"}
            )
            assert result.scalar_one() == 3

    async def test_brute_force_is_stopped(self, app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            email = f"brute_{uuid.uuid4().hex[:8]}@test.com"
            await register(client, email)
            codes = [
                (await client.post("/api/v1/auth/login", json={"email": email, "password": f"guess{i}"})).status_code
                for i in range(10)
            ]
            assert codes[:5] == [401] * 5
            assert set(codes[5:]) == {429}

            # Once limited, even the right password is refused from this client.
            resp = await client.post("/api/v1/auth/login", json={"email": email, "password": "securepass123"})
            assert resp.status_code == 429

    async def test_repeated_registration_attempts_count(self, app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            email = f"dup_{uuid.uuid4().hex[:8]}@test.com"
            await register(client, email)
            for _ in range(9):
                resp = await client.post("/api/v1/auth/register", json={"email": email, "password": "securepass123"})
                assert resp.status_code == 202
            resp = await client.post(
                "/api/v1/auth/register",
                json={"email": f"new_{uuid.uuid4().hex[:8]}@test.com", "password": "securepass123"},
            )
            assert resp.status_code == 429


class TestClientIp:
    async def test_spoofed_forwarded_for_is_ignored(self, app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            codes = []
            for i in range(12):
                resp = await client.post(
                    "/api/v1/auth/register",
                    json={"email": f"spoof{i}_{uuid.uuid4().hex[:6]}@test.com", "password": "securepass123"},
                    headers={"X-Forwarded-For": f"10.0.0.{i}", "X-Real-IP": f"10.1.0.{i}"},
                )
                codes.append(resp.status_code)
            assert codes[:10] == [202] * 10
            assert codes[10:] == [429, 429]

    async def test_forwarded_for_honoured_from_trusted_proxy(self, app, monkeypatch):
        from app.settings import settings

        monkeypatch.setattr(settings, "TRUSTED_PROXY_IPS", ["127.0.0.1"])
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            email = f"proxy_{uuid.uuid4().hex[:8]}@test.com"
            await register(client, email)
            attacker = {"X-Forwarded-For": "203.0.113.9"}
            for _ in range(6):
                await client.post(
                    "/api/v1/auth/login", json={"email": email, "password": "wrong-pass"}, headers=attacker
                )
            resp = await client.post(
                "/api/v1/auth/login", json={"email": email, "password": "wrong-pass"}, headers=attacker
            )
            assert resp.status_code == 429

            # The account owner, on a different IP, is not locked out by the attacker.
            owner = {"X-Forwarded-For": "198.51.100.7"}
            resp = await client.post(
                "/api/v1/auth/login", json={"email": email, "password": "securepass123"}, headers=owner
            )
            assert resp.status_code == 200


class TestConfirmationRace:
    async def test_concurrent_confirmations_verify_once_and_keep_one_account(self, app):
        import asyncio

        from tests.integration.helpers import emails_to, otp_code

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            email = f"race_{uuid.uuid4().hex[:8]}@test.com"
            codes = []
            for password in ("first-password", "second-password"):
                resp = await client.post("/api/v1/auth/register", json={"email": email, "password": password})
                assert resp.status_code == 202
                codes.append(otp_code(email))
            assert len(emails_to(email)) == 2

            responses = await asyncio.gather(*[
                client.post("/api/v1/auth/verify-otp", json={"email": email, "otp": code}) for code in codes
            ])
            assert sorted(r.status_code for r in responses) == [200, 400]

        async with _test_session_factory() as session:
            count = await session.scalar(text("SELECT count(*) FROM users WHERE email = :e"), {"e": email})
            assert count == 1


class TestInputValidation:
    async def test_malformed_id_is_422(self, app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            token = await register(client, f"uuid_{uuid.uuid4().hex[:8]}@test.com")
            h = {"Authorization": f"Bearer {token}"}
            for path in ("/api/v1/claims/not-a-uuid", "/api/v1/documents/nope", "/api/v1/evidence/x", "/api/v1/verification/1"):
                resp = await client.get(path, headers=h)
                assert resp.status_code == 422, path
            resp = await client.post("/api/v1/verification/", json={"claim_id": "bad"}, headers=h)
            assert resp.status_code == 422

    async def test_inline_document_must_be_text(self, app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            token = await register(client, f"inline_{uuid.uuid4().hex[:8]}@test.com")
            resp = await client.post(
                "/api/v1/documents/",
                json={"filename": "fake.pdf", "content": "not really a pdf", "document_type": "pdf"},
                headers={"Authorization": f"Bearer {token}"},
            )
            assert resp.status_code == 422

    async def test_inline_text_document_gets_pages(self, app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            token = await register(client, f"pages_{uuid.uuid4().hex[:8]}@test.com")
            h = {"Authorization": f"Bearer {token}"}
            resp = await client.post(
                "/api/v1/documents/", json={"filename": "n.txt", "content": "Some notes"}, headers=h
            )
            assert resp.status_code == 201
            assert resp.json()["processing_status"] == "processed"
            pages = await client.get(f"/api/v1/documents/{resp.json()['id']}/pages", headers=h)
            assert pages.json()["total_pages"] == 1


class TestFailedUpload:
    async def test_failed_pdf_upload_is_recorded(self, app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            token = await register(client, f"fail_{uuid.uuid4().hex[:8]}@test.com")
            h = {"Authorization": f"Bearer {token}"}
            resp = await client.post(
                "/api/v1/documents/upload",
                files={"file": ("broken.pdf", b"%PDF-1.4 this is not a real pdf", "application/pdf")},
                headers=h,
            )
            assert resp.status_code == 422

            docs = await client.get("/api/v1/documents/", headers=h)
            assert [d["processing_status"] for d in docs.json()] == ["failed"]


class TestConcurrentVerification:
    async def test_second_verification_while_locked_is_409(self, app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            token = await register(client, f"lock_{uuid.uuid4().hex[:8]}@test.com")
            h = {"Authorization": f"Bearer {token}"}
            claim_id = (await client.post("/api/v1/claims/", json={"text": "Locked claim"}, headers=h)).json()["id"]

            # Simulate a verification already running by holding the claim's row lock.
            async with _test_session_factory() as holder:
                await holder.execute(
                    text("SELECT id FROM claims WHERE id = :id FOR UPDATE"), {"id": claim_id}
                )
                resp = await client.post("/api/v1/verification/", json={"claim_id": claim_id}, headers=h)
                assert resp.status_code == 409
                assert resp.json()["error"] == "CONFLICT"
                await holder.rollback()

            resp = await client.post("/api/v1/verification/", json={"claim_id": claim_id}, headers=h)
            assert resp.status_code == 201


class TestEvidenceSnapshotIntegrity:
    async def _verified_claim(self, client: AsyncClient) -> tuple[dict[str, str], str, str]:
        token = await register(client, f"snap_{uuid.uuid4().hex[:8]}@test.com")
        h = {"Authorization": f"Bearer {token}"}
        claim_id = (await client.post("/api/v1/claims/", json={"text": "Snapshot claim"}, headers=h)).json()["id"]
        doc_id = (await client.post(
            "/api/v1/documents/", json={"filename": "s.txt", "content": "Snapshot claim"}, headers=h
        )).json()["id"]
        ev_id = (await client.post(
            "/api/v1/evidence/",
            json={"claim_id": claim_id, "content": "Snapshot claim", "document_id": doc_id},
            headers=h,
        )).json()["id"]
        resp = await client.post("/api/v1/verification/", json={"claim_id": claim_id}, headers=h)
        assert resp.status_code == 201
        return h, claim_id, ev_id

    async def test_database_refuses_deleting_snapshotted_evidence(self, app):
        from sqlalchemy.exc import IntegrityError

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            _, _, ev_id = await self._verified_claim(client)

        # Bypass the application check entirely: the constraint must still hold.
        async with _test_session_factory() as session:
            try:
                await session.execute(text("DELETE FROM evidence WHERE id = :id"), {"id": ev_id})
                await session.commit()
                raise AssertionError("snapshotted evidence was deleted")
            except IntegrityError:
                await session.rollback()

    async def test_race_past_the_app_check_still_returns_409(self, app, monkeypatch):
        from modules.evidence.infrastructure.persistence.postgres_evidence_repository import (
            PostgresEvidenceRepository,
        )

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            h, _, ev_id = await self._verified_claim(client)

            async def not_used(self, evidence_id):  # simulates the check running before the snapshot
                return False

            monkeypatch.setattr(PostgresEvidenceRepository, "is_used_in_verification", not_used)
            resp = await client.delete(f"/api/v1/evidence/{ev_id}", headers=h)
            assert resp.status_code == 409
            assert (await client.get(f"/api/v1/evidence/{ev_id}", headers=h)).status_code == 200

    async def test_deleting_a_user_still_cascades_through_verifications(self, app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            h, claim_id, ev_id = await self._verified_claim(client)
            user_id = (await client.get("/api/v1/auth/me", headers=h)).json()["user_id"]

        async with _test_session_factory() as session:
            await session.execute(text("DELETE FROM users WHERE id = :id"), {"id": user_id})
            await session.commit()
            remaining = await session.scalar(
                text("SELECT count(*) FROM evidence WHERE id = :id"), {"id": ev_id}
            )
            assert remaining == 0
