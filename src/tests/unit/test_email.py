from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.settings import Settings
from shared.infrastructure import email as email_module
from shared.infrastructure.email import EmailMessage, SmtpEmailSender, send_quietly


class FakeSMTP:
    instances: list[FakeSMTP] = []

    def __init__(self, host: str, port: int, timeout: float, **kwargs: object) -> None:
        self.host, self.port = host, port
        self.calls: list[str] = []
        self.sent: list[object] = []
        FakeSMTP.instances.append(self)

    def __enter__(self) -> FakeSMTP:
        return self

    def __exit__(self, *exc: object) -> None:
        self.calls.append("quit")

    def starttls(self, context: object) -> None:
        self.calls.append("starttls")

    def login(self, username: str, password: str) -> None:
        self.calls.append(f"login:{username}")

    def send_message(self, message: object) -> None:
        self.sent.append(message)


def _sender(security: str, username: str = "mailer") -> SmtpEmailSender:
    return SmtpEmailSender(
        host="smtp.test", port=587, username=username, password="pw",
        security=security, sender="ProofLens <no-reply@test>", timeout=5,
    )


async def test_smtp_sender_uses_starttls_and_login(monkeypatch: pytest.MonkeyPatch):
    FakeSMTP.instances.clear()
    monkeypatch.setattr(email_module.smtplib, "SMTP", FakeSMTP)

    await _sender("starttls").send(EmailMessage(to="a@b.c", subject="Hi", text="Body"))

    [smtp] = FakeSMTP.instances
    assert smtp.calls == ["starttls", "login:mailer", "quit"]
    [message] = smtp.sent
    assert message["To"] == "a@b.c"
    assert message["From"] == "ProofLens <no-reply@test>"
    assert message["Subject"] == "Hi"


async def test_smtp_sender_without_auth_or_tls(monkeypatch: pytest.MonkeyPatch):
    FakeSMTP.instances.clear()
    monkeypatch.setattr(email_module.smtplib, "SMTP", FakeSMTP)

    await _sender("none", username="").send(EmailMessage(to="a@b.c", subject="Hi", text="Body"))

    assert FakeSMTP.instances[0].calls == ["quit"]


async def test_send_quietly_swallows_delivery_errors():
    class Broken:
        async def send(self, message: EmailMessage) -> None:
            raise ConnectionRefusedError("mail server down")

    await send_quietly(Broken(), EmailMessage(to="a@b.c", subject="s", text="t"))


def test_production_refuses_console_email():
    with pytest.raises(ValidationError, match="configure resend or smtp"):
        Settings(_env_file=None, ENVIRONMENT="production", EMAIL_BACKEND="console")
    Settings(_env_file=None, ENVIRONMENT="production", EMAIL_BACKEND="smtp")


def test_otp_length_must_be_reasonable():
    with pytest.raises(ValidationError, match="OTP_LENGTH"):
        Settings(_env_file=None, OTP_LENGTH=2)
    with pytest.raises(ValidationError, match="OTP_LENGTH"):
        Settings(_env_file=None, OTP_LENGTH=11)
    Settings(_env_file=None, OTP_LENGTH=6)
