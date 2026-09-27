from __future__ import annotations

import hashlib
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
from fastapi import Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from shared.infrastructure.database import get_session

_password_hasher = PasswordHasher(
    time_cost=3,
    memory_cost=65536,
    parallelism=4,
    hash_len=32,
    salt_len=16,
)

_MAX_PASSWORD_LENGTH = 128
_PBKDF2_LEGACY_ITERATIONS = 100_000
_PBKDF2_CURRENT_ITERATIONS = 600_000
_PBKDF2_HASH_LEN = 32


@dataclass(frozen=True)
class CurrentUser:
    id: UUID
    email: str


def hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode()).hexdigest()


def generate_token() -> str:
    return secrets.token_hex(32)


def hash_password(password: str) -> str:
    """Hash with Argon2id. The salt is embedded in the returned hash string."""
    return _password_hasher.hash(password)


# Verified against when the email is unknown, so a login for a non-existent
# account costs the same as one for a real account (prevents user enumeration by timing).
_DUMMY_PASSWORD_HASH = _password_hasher.hash("prooflens-timing-equalizer")


def verify_dummy_password(password: str) -> None:
    try:
        _password_hasher.verify(_DUMMY_PASSWORD_HASH, password[:_MAX_PASSWORD_LENGTH])
    except VerificationError:
        pass


def _is_pbkdf2_hash(salt_hex: str, hash_hex: str) -> bool:
    if not salt_hex:
        return False
    try:
        salt_bytes = bytes.fromhex(salt_hex)
        hash_bytes = bytes.fromhex(hash_hex)
        return len(salt_bytes) == 16 and len(hash_bytes) == _PBKDF2_HASH_LEN
    except ValueError:
        return False


def _verify_pbkdf2(password: str, salt_hex: str, hash_hex: str) -> bool:
    try:
        salt_bytes = bytes.fromhex(salt_hex)
        expected = bytes.fromhex(hash_hex)

        derived_legacy = hashlib.pbkdf2_hmac(
            "sha256", password.encode(), salt_bytes, _PBKDF2_LEGACY_ITERATIONS, _PBKDF2_HASH_LEN
        )
        if secrets.compare_digest(derived_legacy, expected):
            return True

        derived_current = hashlib.pbkdf2_hmac(
            "sha256", password.encode(), salt_bytes, _PBKDF2_CURRENT_ITERATIONS, _PBKDF2_HASH_LEN
        )
        return secrets.compare_digest(derived_current, expected)
    except (ValueError, TypeError):
        return False


def verify_password(password: str, salt_hex: str, hashed_hex: str) -> bool:
    if len(password) > _MAX_PASSWORD_LENGTH:
        return False
    if _is_pbkdf2_hash(salt_hex, hashed_hex):
        return _verify_pbkdf2(password, salt_hex, hashed_hex)
    try:
        return _password_hasher.verify(hashed_hex, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def rehash_password_on_success(
    password: str, salt_hex: str, hashed_hex: str
) -> str | None:
    if _is_pbkdf2_hash(salt_hex, hashed_hex):
        return _password_hasher.hash(password)
    return None


async def get_current_user(
    authorization: str = Header(default=""),
    session: AsyncSession = Depends(get_session, scope="function"),
) -> CurrentUser:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")

    raw_token = authorization[7:]
    token_hash = hash_token(raw_token)

    from modules.users.infrastructure.persistence.user_model import AuthTokenModel, UserModel

    result = await session.execute(
        select(AuthTokenModel).where(AuthTokenModel.token_hash == token_hash)
    )
    token_row = result.scalar_one_or_none()

    if token_row is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    if token_row.revoked_at is not None:
        raise HTTPException(status_code=401, detail="Token has been revoked")

    if token_row.expires_at < datetime.now(UTC):
        raise HTTPException(status_code=401, detail="Token expired")

    user_result = await session.execute(
        select(UserModel).where(UserModel.id == token_row.user_id)
    )
    user_row = user_result.scalar_one_or_none()

    if user_row is None:
        raise HTTPException(status_code=401, detail="User not found")

    return CurrentUser(id=UUID(user_row.id), email=user_row.email)
