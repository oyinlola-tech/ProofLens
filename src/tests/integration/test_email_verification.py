from __future__ import annotations

import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from app.settings import settings
from tests.conftest import _test_session_factory
from tests.integration.helpers import OUTBOX, emails_to, otp_code, register

REGISTER = "/api/v1/auth/register"
VERIFY_OTP = "/api/v1/auth/verify-otp"
RESEND = "/api/v1/auth/resend-verification"
LOGIN = "/api/v1/auth/login"


def _email(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}@test.com"


async def _user_row(email: str) -> tuple[int, bool]:
    async with _test_session_factory() as session:
        rows = (
            await session.execute(
                text("SELECT email_verified_at FROM users WHERE email = :e"), {"e": email}
            )
        ).all()
    return len(rows), bool(rows and rows[0][0] is not None)


@pytest.fixture
def no_cooldown(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(settings, "OTP_RESEND_COOLDOWN_SECONDS", 0)


class TestRegistration:
    async def test_register_creates_unverified_account_and_sends_otp(self, app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            email = _email("new")
            resp = await client.post(REGISTER, json={"email": email, "password": "securepass123"})
            assert resp.status_code == 202
            body = resp.json()
            assert "token" not in body
            assert body["code_length"] == settings.OTP_LENGTH
            assert body["resend_cooldown_seconds"] == settings.OTP_RESEND_COOLDOWN_SECONDS
            assert body["expires_in_minutes"] == settings.OTP_EXPIRY_MINUTES

            [message] = emails_to(email)
            assert message.subject == "Verify your ProofLens email"
            assert message.html and otp_code(email) in message.html
            assert otp_code(email).isdigit() and len(otp_code(email)) == settings.OTP_LENGTH

            assert await _user_row(email) == (1, False)
            resp = await client.post(LOGIN, json={"email": email, "password": "securepass123"})
            assert resp.status_code == 403

    async def test_confirming_verifies_account_logs_in_and_welcomes(self, app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            email = _email("confirm")
            token = await register(client, email)

            me = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
            assert me.status_code == 200
            assert me.json()["email"] == email
            assert await _user_row(email) == (1, True)
            resp = await client.post(LOGIN, json={"email": email, "password": "securepass123"})
            assert resp.status_code == 200
            assert [m.subject for m in emails_to(email)] == [
                "Verify your ProofLens email",
                "Welcome to ProofLens",
            ]

    async def test_existing_address_gets_identical_response_and_a_notice(self, app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            fresh = await client.post(REGISTER, json={"email": _email("fresh"), "password": "securepass123"})

            email = _email("taken")
            await register(client, email, "original-password")
            OUTBOX.clear()
            again = await client.post(REGISTER, json={"email": email, "password": "attacker-password"})

            assert again.status_code == fresh.status_code == 202
            assert again.json() == fresh.json()
            [notice] = emails_to(email)
            assert notice.subject == "You already have a ProofLens account"
            assert notice.html

            ok = await client.post(LOGIN, json={"email": email, "password": "original-password"})
            assert ok.status_code == 200
            bad = await client.post(LOGIN, json={"email": email, "password": "attacker-password"})
            assert bad.status_code == 401

    async def test_unconfirmed_signup_does_not_block_the_real_owner(self, app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            email = _email("victim")
            await client.post(REGISTER, json={"email": email, "password": "squatter-password"})
            await register(client, email, "owner-password")

            ok = await client.post(LOGIN, json={"email": email, "password": "owner-password"})
            assert ok.status_code == 200
            bad = await client.post(LOGIN, json={"email": email, "password": "squatter-password"})
            assert bad.status_code == 401
            assert await _user_row(email) == (1, True)

    async def test_email_addresses_are_case_insensitive(self, app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            local = f"Mixed_{uuid.uuid4().hex[:8]}"
            resp = await client.post(
                REGISTER, json={"email": f"{local}@Example.COM", "password": "securepass123"}
            )
            assert resp.status_code == 202
            email = f"{local.lower()}@example.com"
            await client.post(VERIFY_OTP, json={"email": email, "otp": otp_code(email)})

            resp = await client.post(LOGIN, json={"email": email.upper(), "password": "securepass123"})
            assert resp.status_code == 200
            assert await _user_row(email) == (1, True)

    async def test_confirmation_emails_are_capped_per_address(self, app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            email = _email("spam")
            for _ in range(settings.MAX_VERIFICATION_EMAILS_PER_HOUR + 2):
                resp = await client.post(REGISTER, json={"email": email, "password": "securepass123"})
                assert resp.status_code == 202
            assert len(emails_to(email)) == settings.MAX_VERIFICATION_EMAILS_PER_HOUR


class TestOtpVerification:
    async def test_unknown_email_is_rejected_as_invalid(self, app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(VERIFY_OTP, json={"email": _email("bad"), "otp": "000000"})
            assert resp.status_code == 400
            assert resp.json()["error"] == "OTP_INVALID"

    async def test_non_numeric_code_is_rejected_by_validation(self, app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(VERIFY_OTP, json={"email": _email("bad"), "otp": "abc123"})
            assert resp.status_code == 422

    async def test_wrong_code_reports_invalid_and_counts_attempts(self, app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            email = _email("wrong")
            await client.post(REGISTER, json={"email": email, "password": "securepass123"})
            code = otp_code(email)
            wrong = str((int(code) + 1) % 10**settings.OTP_LENGTH).zfill(settings.OTP_LENGTH)

            resp = await client.post(VERIFY_OTP, json={"email": email, "otp": wrong})
            assert resp.status_code == 400
            assert resp.json()["error"] == "OTP_INVALID"
            assert resp.json()["attempts_remaining"] == settings.OTP_MAX_ATTEMPTS - 1

            async with _test_session_factory() as session:
                attempts = await session.scalar(
                    text("SELECT attempts FROM otp_records WHERE email = :e AND used_at IS NULL"),
                    {"e": email},
                )
            assert attempts == 1
            assert (await client.post(VERIFY_OTP, json={"email": email, "otp": code})).status_code == 200

    async def test_attempt_limit_locks_the_code(self, app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            email = _email("lock")
            await client.post(REGISTER, json={"email": email, "password": "securepass123"})
            code = otp_code(email)
            wrong = str((int(code) + 1) % 10**settings.OTP_LENGTH).zfill(settings.OTP_LENGTH)
            statuses = []
            for _ in range(settings.OTP_MAX_ATTEMPTS):
                statuses.append((await client.post(VERIFY_OTP, json={"email": email, "otp": wrong})).json()["error"])
            assert statuses[-1] == "OTP_ATTEMPTS_EXCEEDED"
            assert statuses[:-1] == ["OTP_INVALID"] * (settings.OTP_MAX_ATTEMPTS - 1)

            resp = await client.post(VERIFY_OTP, json={"email": email, "otp": code})
            assert resp.status_code == 429
            assert resp.json()["error"] == "OTP_ATTEMPTS_EXCEEDED"
            assert await _user_row(email) == (1, False)

    async def test_otp_works_only_once(self, app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            email = _email("once")
            await client.post(REGISTER, json={"email": email, "password": "securepass123"})
            code = otp_code(email)
            assert (await client.post(VERIFY_OTP, json={"email": email, "otp": code})).status_code == 200
            replay = await client.post(VERIFY_OTP, json={"email": email, "otp": code})
            assert replay.status_code == 400
            assert replay.json()["error"] == "OTP_INVALID"

    async def test_expired_otp_is_rejected(self, app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            email = _email("expired")
            await client.post(REGISTER, json={"email": email, "password": "securepass123"})
            async with _test_session_factory() as session:
                await session.execute(
                    text("UPDATE otp_records SET expires_at = now() - interval '1 minute' WHERE email = :e"),
                    {"e": email},
                )
                await session.commit()

            resp = await client.post(VERIFY_OTP, json={"email": email, "otp": otp_code(email)})
            assert resp.status_code == 400
            assert resp.json()["error"] == "OTP_EXPIRED"
            assert await _user_row(email) == (1, False)

    async def test_confirming_one_otp_invalidates_the_others(self, app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            email = _email("multi")
            await client.post(REGISTER, json={"email": email, "password": "first-password"})
            first = otp_code(email)
            await client.post(REGISTER, json={"email": email, "password": "second-password"})
            second = otp_code(email)

            assert (await client.post(VERIFY_OTP, json={"email": email, "otp": second})).status_code == 200
            assert (await client.post(VERIFY_OTP, json={"email": email, "otp": first})).status_code == 400
            resp = await client.post(LOGIN, json={"email": email, "password": "second-password"})
            assert resp.status_code == 200

    async def test_stored_otp_is_only_a_salted_hash(self, app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            email = _email("digest")
            await client.post(REGISTER, json={"email": email, "password": "securepass123"})
            code = otp_code(email)
        async with _test_session_factory() as session:
            stored, user_id = (
                await session.execute(
                    text("SELECT otp_hash, user_id FROM otp_records WHERE email = :e"), {"e": email}
                )
            ).one()
        assert stored.startswith("$argon2id$")
        assert code not in stored
        assert user_id is not None

    async def test_error_responses_never_leak_internals(self, app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(VERIFY_OTP, json={"email": _email("leak"), "otp": "123456"})
            body = resp.text.lower()
            assert "traceback" not in body and "sqlalchemy" not in body and "argon2" not in body


class TestResend:
    async def test_resend_sends_a_fresh_otp(self, app, no_cooldown):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            email = _email("resend")
            await client.post(REGISTER, json={"email": email, "password": "securepass123"})
            first = otp_code(email)

            resp = await client.post(RESEND, json={"email": email})
            assert resp.status_code == 202
            second = otp_code(email)
            assert second != first

            assert (await client.post(VERIFY_OTP, json={"email": email, "otp": first})).status_code == 400
            assert (await client.post(VERIFY_OTP, json={"email": email, "otp": second})).status_code == 200
            resp = await client.post(LOGIN, json={"email": email, "password": "securepass123"})
            assert resp.status_code == 200

    async def test_resend_cooldown_is_enforced_with_retry_after(self, app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            email = _email("cooldown")
            await client.post(REGISTER, json={"email": email, "password": "securepass123"})
            resp = await client.post(RESEND, json={"email": email})
            assert resp.status_code == 429
            assert resp.json()["error"] == "RATE_LIMITED"
            assert 1 <= resp.json()["retry_after"] <= settings.OTP_RESEND_COOLDOWN_SECONDS + 1
            assert resp.headers["Retry-After"] == str(resp.json()["retry_after"])
            assert len(emails_to(email)) == 1

    async def test_cooldown_applies_to_unknown_addresses_identically(self, app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            unknown = _email("nobody")
            first = await client.post(RESEND, json={"email": unknown})
            second = await client.post(RESEND, json={"email": unknown})
            assert first.status_code == 202
            assert second.status_code == 429
            assert OUTBOX == []

    async def test_resend_reveals_nothing(self, app, no_cooldown):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            confirmed = _email("confirmed")
            await register(client, confirmed)
            OUTBOX.clear()

            unknown = await client.post(RESEND, json={"email": _email("nobody")})
            known = await client.post(RESEND, json={"email": confirmed})
            assert unknown.status_code == known.status_code == 202
            assert unknown.json() == known.json()
            assert OUTBOX == []

    async def test_resend_is_rate_limited_per_ip(self, app, no_cooldown):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            codes = [
                (await client.post(RESEND, json={"email": _email("rl")})).status_code for _ in range(11)
            ]
            assert codes[:10] == [202] * 10
            assert codes[10] == 429


class TestLegacyUnconfirmedAccounts:
    async def _insert_legacy_user(self, email: str, password: str) -> None:
        from shared.infrastructure.auth import hash_password

        async with _test_session_factory() as session:
            await session.execute(
                text(
                    "INSERT INTO users (id, email, password_salt, password_hash, created_at) "
                    "VALUES (:id, :email, '', :hash, now())"
                ),
                {"id": str(uuid.uuid4()), "email": email, "hash": hash_password(password)},
            )
            await session.commit()

    async def test_unconfirmed_account_must_confirm_before_login(self, app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            email = _email("legacy")
            await self._insert_legacy_user(email, "legacy-password")

            wrong = await client.post(LOGIN, json={"email": email, "password": "nope-nope"})
            assert wrong.status_code == 401
            blocked = await client.post(LOGIN, json={"email": email, "password": "legacy-password"})
            assert blocked.status_code == 403

            assert (await client.post(RESEND, json={"email": email})).status_code == 202
            verified = await client.post(VERIFY_OTP, json={"email": email, "otp": otp_code(email)})
            assert verified.status_code == 200

            resp = await client.post(LOGIN, json={"email": email, "password": "legacy-password"})
            assert resp.status_code == 200
            assert await _user_row(email) == (1, True)


class TestEmailDelivery:
    async def test_provider_failure_does_not_break_registration(self, app):
        from shared.infrastructure.email import EmailDeliveryError, get_email_sender

        class FailingSender:
            async def send(self, message):
                raise EmailDeliveryError("resend", "HTTPError")

        app.dependency_overrides[get_email_sender] = FailingSender
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            email = _email("fail")
            resp = await client.post(REGISTER, json={"email": email, "password": "securepass123"})
            assert resp.status_code == 202
            assert "HTTPError" not in resp.text and "EmailDeliveryError" not in resp.text
            assert await _user_row(email) == (1, False)
