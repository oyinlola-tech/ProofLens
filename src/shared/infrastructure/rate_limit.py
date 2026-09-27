from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import DateTime, Integer, String, UniqueConstraint, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

from shared.infrastructure.database import Base

logger = logging.getLogger(__name__)


class RateLimitModel(Base):
    __tablename__ = "rate_limits"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    key: Mapped[str] = mapped_column(String(255), nullable=False)
    window_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    __table_args__ = (
        UniqueConstraint("key", "window_start", name="uq_rate_limits_key_window_start"),
        {"extend_existing": True},
    )


# Failed logins are limited per (email, IP) so an attacker cannot lock a victim out of
# their account from elsewhere, plus a per-IP cap that stops password spraying across emails.
MAX_LOGIN_ATTEMPTS = 5
MAX_LOGIN_ATTEMPTS_PER_IP = 50
MAX_REGISTER_ATTEMPTS = 10
MAX_OTP_ATTEMPTS = 10
_LOGIN_WINDOW_SECONDS = 900
_REGISTER_WINDOW_SECONDS = 3600
_OTP_WINDOW_SECONDS = 900


def _get_window_start(window_seconds: int) -> datetime:
    now = datetime.now(UTC)
    epoch_seconds = int(now.timestamp())
    window_start_seconds = epoch_seconds - (epoch_seconds % window_seconds)
    return datetime.fromtimestamp(window_start_seconds, tz=UTC)


def _get_window_end(window_seconds: int) -> datetime:
    return _get_window_start(window_seconds) + timedelta(seconds=window_seconds)


async def _atomic_increment(session: AsyncSession, key: str, window_seconds: int) -> int:
    window_start = _get_window_start(window_seconds)
    expires_at = _get_window_end(window_seconds)

    stmt = (
        insert(RateLimitModel)
        .values(
            key=key,
            window_start=window_start,
            attempts=1,
            expires_at=expires_at,
        )
        .on_conflict_do_update(
            index_elements=["key", "window_start"],
            set_={
                "attempts": RateLimitModel.attempts + 1,
                "expires_at": expires_at,
            },
        )
        .returning(RateLimitModel.attempts)
    )
    result = await session.execute(stmt)
    count = result.scalar_one()
    await session.flush()
    return count


def _login_key(email: str, ip_hash: str) -> str:
    return f"login:{email.lower().strip()}:{ip_hash}"


def _login_ip_key(ip_hash: str) -> str:
    return f"login-ip:{ip_hash}"


async def _current_attempts(session: AsyncSession, key: str, window_seconds: int) -> int:
    window_start = _get_window_start(window_seconds)
    result = await session.execute(
        select(RateLimitModel.attempts).where(
            RateLimitModel.key == key,
            RateLimitModel.window_start == window_start,
        )
    )
    return result.scalar_one_or_none() or 0


async def record_failed_login(session: AsyncSession, email: str, ip_hash: str) -> bool:
    """Record a failed login. Returns True if the caller is now over a limit.

    The caller must commit before raising an HTTP error, or the attempt is rolled back.
    """
    per_account = await _atomic_increment(session, _login_key(email, ip_hash), _LOGIN_WINDOW_SECONDS)
    per_ip = await _atomic_increment(session, _login_ip_key(ip_hash), _LOGIN_WINDOW_SECONDS)
    return per_account > MAX_LOGIN_ATTEMPTS or per_ip > MAX_LOGIN_ATTEMPTS_PER_IP


async def is_login_rate_limited(session: AsyncSession, email: str, ip_hash: str) -> bool:
    per_account = await _current_attempts(session, _login_key(email, ip_hash), _LOGIN_WINDOW_SECONDS)
    if per_account >= MAX_LOGIN_ATTEMPTS:
        return True
    per_ip = await _current_attempts(session, _login_ip_key(ip_hash), _LOGIN_WINDOW_SECONDS)
    return per_ip >= MAX_LOGIN_ATTEMPTS_PER_IP


async def record_register_attempt(session: AsyncSession, ip_hash: str) -> int:
    return await _atomic_increment(session, f"register:{ip_hash}", _REGISTER_WINDOW_SECONDS)


async def is_register_rate_limited(session: AsyncSession, ip_hash: str) -> bool:
    attempts = await _current_attempts(session, f"register:{ip_hash}", _REGISTER_WINDOW_SECONDS)
    return attempts >= MAX_REGISTER_ATTEMPTS


async def consume_quota(session: AsyncSession, key: str, limit: int, window_seconds: int) -> bool:
    """Count one use of `key`. Returns True while the count is within `limit`."""
    return await _atomic_increment(session, key, window_seconds) <= limit


def _otp_key(email: str, ip_hash: str) -> str:
    return f"otp-verify:{email.lower().strip()}:{ip_hash}"


def _otp_ip_key(ip_hash: str) -> str:
    return f"otp-verify-ip:{ip_hash}"


async def record_failed_otp(session: AsyncSession, email: str, ip_hash: str) -> bool:
    """Record a failed OTP verification. Returns True if now over a limit."""
    per_account = await _atomic_increment(session, _otp_key(email, ip_hash), _OTP_WINDOW_SECONDS)
    per_ip = await _atomic_increment(session, _otp_ip_key(ip_hash), _OTP_WINDOW_SECONDS)
    return per_account > MAX_OTP_ATTEMPTS or per_ip > MAX_OTP_ATTEMPTS * 5


async def is_otp_rate_limited(session: AsyncSession, email: str, ip_hash: str) -> bool:
    per_account = await _current_attempts(session, _otp_key(email, ip_hash), _OTP_WINDOW_SECONDS)
    if per_account >= MAX_OTP_ATTEMPTS:
        return True
    per_ip = await _current_attempts(session, _otp_ip_key(ip_hash), _OTP_WINDOW_SECONDS)
    return per_ip >= MAX_OTP_ATTEMPTS * 5


async def consume_cooldown(session: AsyncSession, key: str, seconds: int) -> int:
    """Count one use of `key`; returns 0 when allowed, else seconds until the window reopens."""
    if seconds <= 0 or await _atomic_increment(session, key, seconds) <= 1:
        return 0
    remaining = (_get_window_end(seconds) - datetime.now(UTC)).total_seconds()
    return max(1, int(remaining) + 1)
