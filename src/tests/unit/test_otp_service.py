from __future__ import annotations

import logging
import sys
import types

import pytest

from app.settings import settings
from modules.users.application.emails import (
    existing_account_email,
    verification_code_email,
    welcome_email,
)
from modules.users.application.otp_service import generate_otp, hash_otp, otp_matches
from shared.infrastructure.email import (
    ConsoleEmailSender,
    EmailDeliveryError,
    EmailMessage,
    ResendEmailSender,
    get_email_sender,
    send_quietly,
)


def test_generate_otp_is_numeric_and_configurable_length():
    codes = {generate_otp() for _ in range(50)}
    assert all(c.isdigit() and len(c) == settings.OTP_LENGTH for c in codes)
    assert len(codes) > 1
    assert len(generate_otp(8)) == 8


def test_otp_is_hashed_with_argon2_and_verifies():
    code = generate_otp()
    digest = hash_otp(code)
    assert digest.startswith("$argon2id$")
    assert code not in digest
    assert hash_otp(code) != digest
    assert otp_matches(digest, code)
    assert not otp_matches(digest, "000000")
    assert not otp_matches("not-a-hash", code)


def test_verification_email_has_html_and_text_with_required_content():
    message = verification_code_email("Person@Example.org", "482913")
    for body in (message.text, message.html):
        assert "482913" in body
        assert "ProofLens" in body
        assert f"expires in {settings.OTP_EXPIRY_MINUTES} minutes" in body
        assert "never share this code" in body
        assert "did not create a ProofLens account" in body
        assert settings.SUPPORT_EMAIL in body
        assert "/privacy" in body and "/terms" in body
        assert "All rights reserved" in body
    assert message.subject == "Verify your ProofLens email"
    assert "Hi Person" in message.text
    assert 'name="viewport"' in message.html
    assert "verification code expires" in message.html.split("</div>")[0]
    assert "http" not in message.text.split("Need help")[0]


def test_welcome_and_notice_templates():
    welcome = welcome_email("a@b.c")
    assert welcome.subject == "Welcome to ProofLens"
    assert "/app" in welcome.text and "/app" in welcome.html
    notice = existing_account_email("a@b.c")
    assert notice.subject == "You already have a ProofLens account"
    assert "No changes were made" in notice.text and "No changes were made" in notice.html


def test_templates_escape_html():
    message = verification_code_email("<script>@x.y", "123456")
    assert "<script>" not in message.html
    assert "&lt;script&gt;" in message.html


async def test_resend_sender_calls_sdk_with_text_and_html(monkeypatch: pytest.MonkeyPatch):
    sent: list[dict] = []
    fake = types.ModuleType("resend")
    fake.api_key = ""

    class Emails:
        @staticmethod
        def send(params: dict) -> dict:
            sent.append(dict(params))
            return {"id": "email_123"}

    fake.Emails = Emails
    monkeypatch.setitem(sys.modules, "resend", fake)

    sender = ResendEmailSender(api_key="re_test", sender="ProofLens <no-reply@prooflens.app>")
    await sender.send(EmailMessage(to="to@x.y", subject="Subj", text="plain", html="<p>html</p>"))

    assert fake.api_key == "re_test"
    assert sent == [{
        "from": "ProofLens <no-reply@prooflens.app>",
        "to": ["to@x.y"],
        "subject": "Subj",
        "text": "plain",
        "html": "<p>html</p>",
    }]


async def test_resend_failure_is_wrapped_without_details(monkeypatch: pytest.MonkeyPatch, caplog):
    fake = types.ModuleType("resend")

    class Emails:
        @staticmethod
        def send(params: dict) -> dict:
            raise RuntimeError("secret api key re_live_123 rejected")

    fake.Emails = Emails
    monkeypatch.setitem(sys.modules, "resend", fake)
    sender = ResendEmailSender(api_key="re_live_123", sender="x <x@y.z>")

    with pytest.raises(EmailDeliveryError) as exc:
        await sender.send(EmailMessage(to="to@x.y", subject="s", text="t"))
    assert "re_live_123" not in str(exc.value)
    assert exc.value.__cause__ is None

    with caplog.at_level(logging.ERROR):
        await send_quietly(sender, EmailMessage(to="to@x.y", subject="s", text="t"))
    assert "re_live_123" not in caplog.text
    assert "EmailDeliveryError" in caplog.text


def test_email_backend_selection(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(settings, "EMAIL_BACKEND", "resend")
    monkeypatch.setattr(settings, "RESEND_API_KEY", "re_x")
    assert isinstance(get_email_sender(), ResendEmailSender)
    monkeypatch.setattr(settings, "EMAIL_BACKEND", "console")
    assert isinstance(get_email_sender(), ConsoleEmailSender)


def test_resend_backend_requires_key():
    from app.settings import Settings

    with pytest.raises(ValueError, match="RESEND_API_KEY"):
        Settings(EMAIL_BACKEND="resend", RESEND_API_KEY="", _env_file=None)
