from __future__ import annotations

import secrets
from datetime import UTC, datetime, timedelta
from enum import StrEnum
from uuid import uuid4

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.settings import settings
from modules.users.infrastructure.persistence.otp_model import OtpModel
from shared.errors.base import ApplicationError

_otp_hasher = PasswordHasher(time_cost=2, memory_cost=32_768, parallelism=2, hash_len=32, salt_len=16)
_DUMMY_HASH = _otp_hasher.hash("000000")


class OtpPurpose(StrEnum):
    EMAIL_VERIFICATION = "email_verification"


class OtpRejectedError(ApplicationError):
    """The submitted code cannot be accepted. `code` tells the client which state to show."""


def generate_otp(length: int | None = None) -> str:
    digits = length or settings.OTP_LENGTH
    return str(secrets.randbelow(10**digits)).zfill(digits)


def hash_otp(otp: str) -> str:
    return _otp_hasher.hash(otp)


def otp_matches(otp_hash: str, otp: str) -> bool:
    try:
        return _otp_hasher.verify(otp_hash, otp)
    except (VerificationError, InvalidHashError):
        return False


def _equalize_timing(otp: str) -> None:
    otp_matches(_DUMMY_HASH, otp)


async def issue_otp(
    session: AsyncSession,
    *,
    email: str,
    user_id: str | None,
    purpose: OtpPurpose = OtpPurpose.EMAIL_VERIFICATION,
) -> str:
    """Create a fresh code for `email`, retiring any code still pending for the same purpose."""
    now = datetime.now(UTC)
    await session.execute(
        update(OtpModel)
        .where(
            OtpModel.email == email,
            OtpModel.purpose == purpose.value,
            OtpModel.used_at.is_(None),
        )
        .values(used_at=now)
    )
    otp = generate_otp()
    session.add(
        OtpModel(
            id=str(uuid4()),
            user_id=user_id,
            email=email,
            otp_hash=await run_in_threadpool(hash_otp, otp),
            purpose=purpose.value,
            expires_at=now + timedelta(minutes=settings.OTP_EXPIRY_MINUTES),
            created_at=now,
        )
    )
    await session.flush()
    return otp


async def verify_otp(
    session: AsyncSession,
    *,
    email: str,
    otp: str,
    purpose: OtpPurpose = OtpPurpose.EMAIL_VERIFICATION,
) -> OtpModel:
    """Consume the pending code for `email`; raises OtpRejectedError with a client-facing code.

    Callers must commit after a rejection so the attempt counter is persisted.
    """
    now = datetime.now(UTC)
    result = await session.execute(
        select(OtpModel)
        .where(
            OtpModel.email == email,
            OtpModel.purpose == purpose.value,
            OtpModel.used_at.is_(None),
        )
        .order_by(OtpModel.created_at.desc())
        .limit(1)
        .with_for_update()
    )
    record = result.scalar_one_or_none()

    if record is None:
        await run_in_threadpool(_equalize_timing, otp)
        raise OtpRejectedError(
            "That code is not valid. Request a new one.", code="OTP_INVALID"
        )
    if record.expires_at < now:
        raise OtpRejectedError("This code has expired. Request a new one.", code="OTP_EXPIRED")
    if record.attempts >= settings.OTP_MAX_ATTEMPTS:
        raise OtpRejectedError(
            "Too many incorrect attempts. Request a new code.", code="OTP_ATTEMPTS_EXCEEDED"
        )

    record.attempts += 1
    await session.flush()

    if not await run_in_threadpool(otp_matches, record.otp_hash, otp):
        remaining = settings.OTP_MAX_ATTEMPTS - record.attempts
        if remaining <= 0:
            raise OtpRejectedError(
                "Too many incorrect attempts. Request a new code.", code="OTP_ATTEMPTS_EXCEEDED"
            )
        raise OtpRejectedError(
            "That code is not correct.", code="OTP_INVALID", attempts_remaining=remaining
        )

    record.used_at = now
    await session.flush()
    return record
