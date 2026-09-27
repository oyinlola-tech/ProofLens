from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.settings import settings
from modules.users.application.emails import (
    existing_account_email,
    verification_code_email,
    welcome_email,
)
from modules.users.application.otp_service import OtpRejectedError, issue_otp, verify_otp
from modules.users.infrastructure.persistence.user_model import AuthTokenModel, UserModel
from shared.errors.base import ApplicationError
from shared.infrastructure.auth import (
    CurrentUser,
    generate_token,
    get_current_user,
    hash_password,
    hash_token,
    rehash_password_on_success,
    verify_dummy_password,
    verify_password,
)
from shared.infrastructure.client_ip import client_ip_hash
from shared.infrastructure.database import get_session
from shared.infrastructure.email import EmailMessage, EmailSender, get_email_sender, send_quietly
from shared.infrastructure.rate_limit import (
    consume_cooldown,
    consume_quota,
    is_login_rate_limited,
    is_otp_rate_limited,
    is_register_rate_limited,
    record_failed_login,
    record_failed_otp,
    record_register_attempt,
)

router = APIRouter(prefix="/auth")

PASSWORD_MIN_LENGTH = 8
PASSWORD_MAX_LENGTH = 128
_HOUR = 3600
_RESEND_LIMIT_PER_IP = 10

REGISTER_MESSAGE = "Check your email for a verification code to confirm your address."
RESEND_MESSAGE = "If that address has a pending verification, a new code has been sent."


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < PASSWORD_MIN_LENGTH:
            raise ValueError(f"Password must be at least {PASSWORD_MIN_LENGTH} characters")
        if len(v) > PASSWORD_MAX_LENGTH:
            raise ValueError(f"Password must be at most {PASSWORD_MAX_LENGTH} characters")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class VerifyOtpRequest(BaseModel):
    email: EmailStr
    otp: str = Field(..., min_length=4, max_length=10, pattern=r"^[0-9]+$")


class ResendOtpRequest(BaseModel):
    email: EmailStr


class MessageResponse(BaseModel):
    message: str


class VerificationPendingResponse(BaseModel):
    message: str
    code_length: int
    expires_in_minutes: int
    resend_cooldown_seconds: int


class AuthResponse(BaseModel):
    token: str
    user_id: str


class LogoutRequest(BaseModel):
    token: str


class MeResponse(BaseModel):
    user_id: str
    email: str


async def _enforce_session_limit(session: AsyncSession, user_id: str) -> None:
    result = await session.execute(
        select(AuthTokenModel).where(
            AuthTokenModel.user_id == user_id,
            AuthTokenModel.expires_at > datetime.now(UTC),
            AuthTokenModel.revoked_at.is_(None),
        ).order_by(AuthTokenModel.created_at)
    )
    tokens = result.scalars().all()
    if len(tokens) >= settings.AUTH_MAX_SESSIONS:
        tokens[0].revoked_at = datetime.now(UTC)


async def _issue_token(session: AsyncSession, user_id: str) -> AuthResponse:
    await _enforce_session_limit(session, user_id)
    raw_token = generate_token()
    session.add(
        AuthTokenModel(
            id=str(uuid4()),
            user_id=user_id,
            token_hash=hash_token(raw_token),
            expires_at=datetime.now(UTC) + timedelta(hours=settings.AUTH_TOKEN_EXPIRY_HOURS),
        )
    )
    await session.flush()
    return AuthResponse(token=raw_token, user_id=user_id)


async def _queue_email(
    session: AsyncSession,
    background: BackgroundTasks,
    sender: EmailSender,
    message: EmailMessage,
) -> None:
    if await consume_quota(
        session, f"verify-email:{message.to}", settings.MAX_VERIFICATION_EMAILS_PER_HOUR, _HOUR
    ):
        background.add_task(send_quietly, sender, message)


def _pending_response(message: str) -> VerificationPendingResponse:
    return VerificationPendingResponse(
        message=message,
        code_length=settings.OTP_LENGTH,
        expires_in_minutes=settings.OTP_EXPIRY_MINUTES,
        resend_cooldown_seconds=settings.OTP_RESEND_COOLDOWN_SECONDS,
    )


async def _find_user(session: AsyncSession, email: str) -> UserModel | None:
    return (await session.execute(select(UserModel).where(UserModel.email == email))).scalar_one_or_none()


@router.post(
    "/register",
    response_model=VerificationPendingResponse,
    status_code=202,
    summary="Start registration",
    description=(
        "Creates an unverified account and emails a one-time verification code. The account "
        "can log in once the code is confirmed via /auth/verify-otp. The response is identical "
        "whether or not the address is already registered."
    ),
    responses={429: {"description": "Rate limit exceeded"}},
)
async def register(
    request: RegisterRequest,
    req: Request,
    background: BackgroundTasks,
    session: AsyncSession = Depends(get_session, scope="function"),
    email_sender: EmailSender = Depends(get_email_sender),
) -> VerificationPendingResponse:
    ip_hash = client_ip_hash(req)

    try:
        if await is_register_rate_limited(session, ip_hash):
            raise HTTPException(status_code=429, detail="Too many registration attempts. Please try again later.")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=503, detail="Service temporarily unavailable")
    await record_register_attempt(session, ip_hash)
    await session.commit()

    email = request.email.strip().lower()
    password_hash = await run_in_threadpool(hash_password, request.password)
    existing = await _find_user(session, email)

    if existing is not None and existing.email_verified_at is not None:
        message = existing_account_email(email)
    else:
        if existing is None:
            existing = UserModel(
                id=str(uuid4()),
                email=email,
                password_salt="",
                password_hash=password_hash,
            )
            session.add(existing)
            await session.flush()
        else:
            # Unverified accounts belong to nobody yet: the latest sign-up sets the password.
            existing.password_hash = password_hash
            existing.password_salt = ""
        otp_code = await issue_otp(session, email=email, user_id=existing.id)
        await consume_cooldown(session, f"otp-resend:{email}", settings.OTP_RESEND_COOLDOWN_SECONDS)
        message = verification_code_email(email, otp_code)

    await _queue_email(session, background, email_sender, message)
    await session.commit()
    return _pending_response(REGISTER_MESSAGE)


@router.post(
    "/verify-otp",
    response_model=AuthResponse,
    summary="Verify email with a one-time code",
    description=(
        "Submit the code from the verification email. Marks the account verified and returns "
        "an auth token. Errors carry a code: OTP_INVALID, OTP_EXPIRED or OTP_ATTEMPTS_EXCEEDED."
    ),
    responses={
        400: {"description": "Invalid or expired code"},
        429: {"description": "Too many attempts or rate limit exceeded"},
    },
)
async def verify_otp_endpoint(
    request: VerifyOtpRequest,
    req: Request,
    background: BackgroundTasks,
    session: AsyncSession = Depends(get_session, scope="function"),
    email_sender: EmailSender = Depends(get_email_sender),
) -> AuthResponse:
    email = request.email.strip().lower()
    ip_hash = client_ip_hash(req)

    try:
        if await is_otp_rate_limited(session, email, ip_hash):
            raise ApplicationError(
                "Too many verification attempts. Please try again later.", code="RATE_LIMITED"
            )
    except ApplicationError:
        raise
    except Exception:
        raise HTTPException(status_code=503, detail="Service temporarily unavailable")

    try:
        await verify_otp(session, email=email, otp=request.otp)
    except OtpRejectedError as rejected:
        try:
            now_limited = await record_failed_otp(session, email, ip_hash)
            await session.commit()
        except Exception:
            raise HTTPException(status_code=503, detail="Service temporarily unavailable")
        if now_limited:
            raise ApplicationError(
                "Too many verification attempts. Please try again later.", code="RATE_LIMITED"
            ) from None
        raise rejected

    user = await _find_user(session, email)
    if user is None:
        raise OtpRejectedError("That code is not valid. Request a new one.", code="OTP_INVALID")

    if user.email_verified_at is None:
        user.email_verified_at = datetime.now(UTC)
        await session.flush()
        background.add_task(send_quietly, email_sender, welcome_email(email))

    return await _issue_token(session, user.id)


@router.post(
    "/resend-verification",
    response_model=VerificationPendingResponse,
    status_code=202,
    summary="Resend the verification code",
    description=(
        "Issues a fresh code, invalidating the previous one. Always returns the same response "
        "whether or not a verification is pending; a 429 with retry_after enforces the cooldown."
    ),
    responses={429: {"description": "Cooldown active or rate limit exceeded"}},
)
async def resend_verification(
    request: ResendOtpRequest,
    req: Request,
    background: BackgroundTasks,
    session: AsyncSession = Depends(get_session, scope="function"),
    email_sender: EmailSender = Depends(get_email_sender),
) -> VerificationPendingResponse:
    if not await consume_quota(session, f"resend:{client_ip_hash(req)}", _RESEND_LIMIT_PER_IP, _HOUR):
        await session.commit()
        raise ApplicationError("Too many requests. Please try again later.", code="RATE_LIMITED")

    email = request.email.strip().lower()
    wait = await consume_cooldown(session, f"otp-resend:{email}", settings.OTP_RESEND_COOLDOWN_SECONDS)
    if wait:
        await session.commit()
        raise ApplicationError(
            f"Please wait {wait} seconds before requesting a new code.",
            code="RATE_LIMITED",
            retry_after=wait,
        )

    user = await _find_user(session, email)
    if user is not None and user.email_verified_at is None:
        otp_code = await issue_otp(session, email=email, user_id=user.id)
        await _queue_email(session, background, email_sender, verification_code_email(email, otp_code))

    await session.commit()
    return _pending_response(RESEND_MESSAGE)


@router.post(
    "/login",
    response_model=AuthResponse,
    summary="Log in with email and password",
    description="Authenticate and receive an auth token. Legacy PBKDF2 passwords are transparently upgraded to Argon2id.",
    responses={
        401: {"description": "Invalid credentials"},
        403: {"description": "Email address not confirmed"},
        429: {"description": "Rate limit exceeded"},
    },
)
async def login(
    request: LoginRequest,
    req: Request,
    session: AsyncSession = Depends(get_session, scope="function"),
) -> AuthResponse:
    if len(request.password) > PASSWORD_MAX_LENGTH:
        raise HTTPException(
            status_code=422,
            detail=f"Password must be at most {PASSWORD_MAX_LENGTH} characters",
        )

    email = request.email.strip().lower()
    ip_hash = client_ip_hash(req)

    try:
        if await is_login_rate_limited(session, email, ip_hash):
            raise HTTPException(status_code=429, detail="Too many login attempts. Please try again later.")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=503, detail="Service temporarily unavailable")

    result = await session.execute(select(UserModel).where(UserModel.email == email))
    user = result.scalar_one_or_none()

    if user is None:
        await run_in_threadpool(verify_dummy_password, request.password)
        password_ok = False
    else:
        password_ok = await run_in_threadpool(
            verify_password, request.password, user.password_salt, user.password_hash
        )

    if user is None or not password_ok:
        try:
            now_limited = await record_failed_login(session, email, ip_hash)
            await session.commit()
        except Exception:
            raise HTTPException(status_code=503, detail="Service temporarily unavailable")
        if now_limited:
            raise HTTPException(status_code=429, detail="Too many login attempts. Please try again later.")
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if user.email_verified_at is None:
        raise HTTPException(status_code=403, detail="Confirm your email address before logging in.")

    new_hash = await run_in_threadpool(
        rehash_password_on_success, request.password, user.password_salt, user.password_hash
    )
    if new_hash is not None:
        user.password_hash = new_hash
        user.password_salt = ""

    return await _issue_token(session, user.id)


@router.get(
    "/me",
    response_model=MeResponse,
    summary="Get the current account",
    description="Return the account behind the Bearer token.",
    responses={401: {"description": "Not authenticated"}},
)
async def me(current_user: CurrentUser = Depends(get_current_user)) -> MeResponse:
    return MeResponse(user_id=str(current_user.id), email=current_user.email)


@router.post(
    "/logout",
    status_code=204,
    summary="Log out (revoke current token)",
    description="Invalidate the token sent in the request body.",
)
async def logout(
    request: LogoutRequest,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session, scope="function"),
) -> None:
    token_hash = hash_token(request.token)
    result = await session.execute(
        select(AuthTokenModel).where(
            AuthTokenModel.token_hash == token_hash,
            AuthTokenModel.user_id == str(current_user.id),
        )
    )
    token_row = result.scalar_one_or_none()
    if token_row is not None:
        token_row.revoked_at = datetime.now(UTC)
        await session.flush()


@router.post(
    "/revoke-all",
    status_code=204,
    summary="Revoke all active sessions",
    description="Invalidates every non-revoked token for the current user.",
)
async def revoke_all_tokens(
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session, scope="function"),
) -> None:
    result = await session.execute(
        select(AuthTokenModel).where(
            AuthTokenModel.user_id == str(current_user.id),
            AuthTokenModel.revoked_at.is_(None),
        )
    )
    tokens = result.scalars().all()
    now = datetime.now(UTC)
    for token in tokens:
        token.revoked_at = now
    await session.flush()
