# ProofLens Deep Scan Report

**Date:** 2026-09-26
**Scope:** Full backend (`src/`) + frontend (`apps/web/`, `apps/mobile/`)
**Triggered by:** OTP email verification migration + source-grounded explanation feature

---

## Executive Summary

After implementing OTP-based email verification and source-grounded explanations across the stack, a deep scan was performed to find gaps, security issues, dead code, broken integrations, and inconsistencies.

| Category | Critical | High | Medium | Low |
|----------|----------|------|--------|-----|
| Broken Integration | 1 | 0 | 0 | 0 |
| Security | 0 | 3 | 0 | 0 |
| Dead Code | 0 | 0 | 5 | 0 |
| Missing Wiring | 0 | 0 | 3 | 0 |
| Inconsistencies | 0 | 0 | 2 | 1 |

**Overall:** The codebase is well-structured. No critical application bugs found. The integration test suite is broken after the OTP migration and needs rewriting.

---

## 1. CRITICAL — Broken Integration Tests

The integration test suite is completely misaligned with the OTP-based flow it now tests.

### 1.1 Wrong Endpoint

**File:** `tests/integration/test_email_verification.py:13`

```python
VERIFY = "/api/v1/auth/verify-email"
```

This endpoint **does not exist**. The actual route is `/api/v1/auth/verify-otp`. Every test in `TestConfirmationLinks`, `TestResend`, and `TestLegacyUnconfirmedAccounts` will fail with 404/405.

### 1.2 Wrong Helper — Token Extraction

**File:** `tests/integration/helpers.py:24-30`

```python
_TOKEN_IN_LINK = re.compile(r"token=([A-Za-z0-9_-]+)")
```

`confirmation_token()` extracts a token from a `?token=XXX` link in email text. But `otp_verification_email()` sends a 6-digit OTP code, not a link. The regex will never match.

### 1.3 Wrong Helper — Register Flow

**File:** `tests/integration/helpers.py:37-40`

```python
async def register(session, ...):
    ...
    token = confirmation_token(email_sender)
    return await verify_email(session, token)
```

Calls `verify-email` with a confirmation token, which will 404. Should call `verify-otp` with the OTP code.

### 1.4 Wrong Subject Assertion

**File:** `tests/integration/test_email_verification.py:38`

```python
assert message.subject == "Confirm your ProofLens email address"
```

Actual subject from `otp_verification_email()` is `"Verify your ProofLens email"`.

### 1.5 Wrong Table Reference

**File:** `tests/integration/test_email_verification.py:134`

```python
await session.execute(text("UPDATE pending_registrations SET expires_at = ..."))
```

References `pending_registrations` table (old `PendingRegistrationModel`). Actual table is `otp_records` (`OtpModel`).

---

## 2. HIGH — Security Issues

### 2.1 No IP-Based Rate Limiting on OTP Verification

**File:** `modules/users/presentation/http/routes.py` — `/auth/verify-otp`

The endpoint caps per-account attempts at `OTP_MAX_ATTEMPTS` (5), but there is no IP-based throttle on the endpoint itself. An attacker can:
- Hammer `/auth/verify-otp` unlimited times across different IPs
- Brute-force a 6-digit OTP (1M combinations) by rotating IPs
- Each failed attempt is independent per-IP

**Fix:** Add `is_login_rate_limited` or a dedicated OTP rate limiter on the verify-otp endpoint.

### 2.2 File Upload Reads Entire File Into RAM Before Size Check

**File:** `modules/documents/presentation/http/routes.py:135`

```python
file_data = await file.read()
```

Reads the entire uploaded file into memory before checking `EVIDENCE_MAX_LENGTH`. A 500MB upload will OOM the server before the 50MB limit is enforced.

**Fix:** Stream the upload and check size incrementally, or use `shutil.copyfileobj` with a size limit.

### 2.3 Cookie Secure Flag Defaults to False

**File:** `apps/web/src/lib/auth/session.ts:18`

```typescript
secure: process.env.PROOFLENS_SECURE_COOKIES === "true"
```

If `PROOFLENS_SECURE_COOKIES` is not set in production, cookies transmit over plain HTTP. Session tokens can be intercepted.

**Fix:** Default to `true` when `ENVIRONMENT=production`, or add a startup check.

---

## 3. MEDIUM — Dead Code & Stale Configuration

### 3.1 Dead Module: `email_verification.py`

**File:** `modules/users/application/email_verification.py`

Entire file is dead. Contains old link-based verification (`confirm_registration`, `create_pending_registration`, `verification_email`, `already_registered_email`). Never imported by any route after the OTP migration.

### 3.2 Dead Model: `PendingRegistrationModel`

**File:** `modules/users/infrastructure/persistence/user_model.py:29-45`

```python
class PendingRegistrationModel(Base):
    __tablename__ = "pending_registrations"
    ...
```

Table class exists but is never used by any route or service. Only referenced in the dead `email_verification.py`.

### 3.3 Dead Error Classes

**File:** `shared/errors/domain.py:62-67`

```python
class VerificationNotFoundError(DomainError):
    ...
```

Defined but never raised anywhere. Verification routes return 404 via the generic `DomainError` handler matching `_NOT_FOUND` suffix.

**File:** `shared/errors/domain.py:86-91`

```python
class UnsupportedFileTypeError(DomainError):
    ...
```

Defined but never raised. Document routes raise `InvalidDocumentError` instead.

### 3.4 Stale Settings

**File:** `app/settings.py:89-90`

```python
EMAIL_VERIFICATION_URL: str = "http://localhost:3000/verify-email?token={token}"
EMAIL_VERIFICATION_EXPIRY_HOURS: int = 24
```

Only referenced in the dead `email_verification.py`. The OTP flow uses `OTP_EXPIRY_MINUTES` instead. These settings are unused.

---

## 4. MEDIUM — Missing Wiring

### 4.1 Users Module Not in Module Index

**File:** `modules/__init__.py`

```python
from modules.ai import ...
from modules.claims import ...
from modules.documents import ...
from modules.evidence import ...
from modules.verification import ...
# users is missing
```

Imports all modules except `users`. The module works because routes are registered in `bootstrap.py`, but the index is incomplete.

### 4.2 Empty Users Module Init

**File:** `modules/users/__init__.py`

Empty file. Every other module (`ai`, `claims`, `documents`, `evidence`, `verification`) exports its public API in `__init__.py`.

### 4.3 Incomplete Error Exports

**File:** `shared/errors/__init__.py`

Only exports `DomainError`. Does not re-export `ApplicationError`, `ConflictError`, `NotFoundError`, etc. These are only accessible via `shared.errors.application` directly.

---

## 5. LOW — Inconsistencies

### 5.1 `truncate()` Default Max Length Differs

| App | File | Default |
|-----|------|---------|
| Web | `apps/web/src/lib/format.ts:34` | 140 |
| Mobile | `apps/mobile/src/lib/format.ts:12` | 160 |

### 5.2 `evidence_refs` Typed But Never Rendered

**Files:** `apps/web/src/lib/api/types.ts:80`, `apps/mobile/src/lib/types.ts`

```typescript
evidence_refs: string[];
```

Defined in both type files but never read or rendered in either verification page. The UI only uses `evidence_used` (the detailed list with content). `evidence_refs` is dead data.

---

## 6. What's Working Correctly

- All API endpoint integrations between web/mobile and backend
- All type definitions are in sync between web and mobile
- Auth guards on both platforms (web cookie-based, mobile token-based)
- OTP flow: register → verify-otp → login (fully wired)
- Source-grounded fields render correctly in verification pages
- No XSS, no hardcoded secrets, no eval/inject risks
- Ruff: all checks pass
- Mypy: no issues in 143 source files
- Unit tests: 117/17 pass
- Database migrations: both applied successfully
