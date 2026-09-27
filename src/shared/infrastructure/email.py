from __future__ import annotations

import smtplib
import ssl
from dataclasses import dataclass
from email.message import EmailMessage as MimeMessage
from typing import Protocol

from fastapi.concurrency import run_in_threadpool

from app.settings import settings
from shared.infrastructure.logger import get_logger

logger = get_logger(__name__)


@dataclass(frozen=True)
class EmailMessage:
    to: str
    subject: str
    text: str
    html: str = ""


class EmailDeliveryError(Exception):
    """Delivery failed. The message never carries provider payloads or credentials."""

    def __init__(self, provider: str, detail: str = "") -> None:
        self.provider = provider
        super().__init__(f"{provider} delivery failed" + (f": {detail}" if detail else ""))


class EmailSender(Protocol):
    """Provider abstraction the application depends on (Resend, SMTP, console)."""

    async def send(self, message: EmailMessage) -> None: ...


class ConsoleEmailSender:
    """Development only: prints the message instead of delivering it (refused in production)."""

    async def send(self, message: EmailMessage) -> None:
        logger.info("Email to %s | %s\n%s", message.to, message.subject, message.text)


class ResendEmailSender:
    def __init__(self, api_key: str, sender: str) -> None:
        self._api_key = api_key
        self._sender = sender

    async def send(self, message: EmailMessage) -> None:
        await run_in_threadpool(self._send_sync, message)

    def _send_sync(self, message: EmailMessage) -> None:
        import resend

        resend.api_key = self._api_key
        params: dict[str, object] = {
            "from": self._sender,
            "to": [message.to],
            "subject": message.subject,
            "text": message.text,
        }
        if message.html:
            params["html"] = message.html
        try:
            resend.Emails.send(params)  # type: ignore[arg-type]
        except Exception as e:
            raise EmailDeliveryError("resend", type(e).__name__) from None


class SmtpEmailSender:
    def __init__(
        self,
        host: str,
        port: int,
        username: str,
        password: str,
        security: str,
        sender: str,
        timeout: float,
    ) -> None:
        self._host = host
        self._port = port
        self._username = username
        self._password = password
        self._security = security
        self._sender = sender
        self._timeout = timeout

    async def send(self, message: EmailMessage) -> None:
        await run_in_threadpool(self._send_sync, message)

    def _send_sync(self, message: EmailMessage) -> None:
        try:
            self._deliver(message)
        except (OSError, smtplib.SMTPException) as e:
            raise EmailDeliveryError("smtp", type(e).__name__) from None

    def _deliver(self, message: EmailMessage) -> None:
        mime = MimeMessage()
        mime["From"] = self._sender
        mime["To"] = message.to
        mime["Subject"] = message.subject
        mime.set_content(message.text)
        if message.html:
            mime.add_alternative(message.html, subtype="html")

        context = ssl.create_default_context()
        smtp: smtplib.SMTP
        if self._security == "ssl":
            smtp = smtplib.SMTP_SSL(self._host, self._port, timeout=self._timeout, context=context)
        else:
            smtp = smtplib.SMTP(self._host, self._port, timeout=self._timeout)
        with smtp:
            if self._security == "starttls":
                smtp.starttls(context=context)
            if self._username:
                smtp.login(self._username, self._password)
            smtp.send_message(mime)


def get_email_sender() -> EmailSender:
    if settings.EMAIL_BACKEND == "resend":
        return ResendEmailSender(api_key=settings.RESEND_API_KEY, sender=settings.EMAIL_FROM)
    if settings.EMAIL_BACKEND == "smtp":
        return SmtpEmailSender(
            host=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USERNAME,
            password=settings.SMTP_PASSWORD,
            security=settings.SMTP_SECURITY,
            sender=settings.EMAIL_FROM,
            timeout=settings.SMTP_TIMEOUT_SECONDS,
        )
    return ConsoleEmailSender()


async def send_quietly(sender: EmailSender, message: EmailMessage) -> None:
    try:
        await sender.send(message)
    except Exception as e:
        logger.error(
            "Failed to send email %r to %s: %s", message.subject, message.to, type(e).__name__
        )
