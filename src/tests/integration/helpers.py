from __future__ import annotations

import re

from httpx import AsyncClient

from shared.infrastructure.email import EmailMessage

OUTBOX: list[EmailMessage] = []

_OTP_PATTERN = re.compile(r"\b(\d{6})\b")


class RecordingEmailSender:
    async def send(self, message: EmailMessage) -> None:
        OUTBOX.append(message)


def emails_to(address: str) -> list[EmailMessage]:
    return [m for m in OUTBOX if m.to == address.lower()]


def otp_code(address: str) -> str:
    """The 6-digit OTP from the most recent verification email sent to `address`."""
    for message in reversed(emails_to(address)):
        match = _OTP_PATTERN.search(message.text)
        if match:
            return match.group(1)
    raise AssertionError(f"No verification email was sent to {address}")


async def register(client: AsyncClient, email: str, password: str = "securepass123") -> str:
    """Sign up and confirm the address with OTP. Returns the bearer token."""
    resp = await client.post("/api/v1/auth/register", json={"email": email, "password": password})
    assert resp.status_code == 202, resp.text
    resp = await client.post(
        "/api/v1/auth/verify-otp", json={"email": email, "otp": otp_code(email)}
    )
    assert resp.status_code == 200, resp.text
    return str(resp.json()["token"])
