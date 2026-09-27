# ProofLens API

FastAPI backend for ProofLens: submit claims, attach evidence from uploaded documents, and get a verification verdict with a confidence score.

## Running locally

Requires Python 3.11+ and PostgreSQL. Run these from this directory (`src/`):

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"

cp .env.example .env          # then edit PROOFLENS_DATABASE_URL etc.
alembic upgrade head          # create / update the schema
python main.py                # serves on PROOFLENS_HOST:PROOFLENS_PORT (default 127.0.0.1:8000)
```

With `PROOFLENS_DEBUG=true` (as in `.env.example`) the server auto-reloads and the interactive docs are at `/docs`. Both are off by default.

## Accounts and email verification

1. `POST /api/v1/auth/register` always returns 202 with the same body, so it never reveals whether an address is registered. A new address gets an unverified account and a six-digit code by email; an unverified address gets its password replaced and a fresh code; a verified address gets an "already registered" notice instead. The body carries `code_length`, `expires_in_minutes` and `resend_cooldown_seconds` so clients can show the right state.
2. `POST /api/v1/auth/verify-otp` takes `{email, otp}`. On success it marks the account verified, sends a welcome email and returns an auth token. Rejections are `400 OTP_INVALID` (with `attempts_remaining`), `400 OTP_EXPIRED`, `429 OTP_ATTEMPTS_EXCEEDED`, or `429 RATE_LIMITED`. Codes expire after `PROOFLENS_OTP_EXPIRY_MINUTES` (10), allow `PROOFLENS_OTP_MAX_ATTEMPTS` (5) tries, work once, and are stored only as Argon2id hashes.
3. `POST /api/v1/auth/resend-verification` issues a fresh code (retiring the previous one) and always returns 202, except during the per-address cooldown, which answers `429 RATE_LIMITED` with `retry_after` for every address alike.
4. `POST /api/v1/auth/login` returns 403 for an unverified account, but only after a correct password.

At most `PROOFLENS_MAX_VERIFICATION_EMAILS_PER_HOUR` (3) verification emails are sent per address per hour. Emails are compared case-insensitively.

Email delivery is configured with `PROOFLENS_EMAIL_BACKEND` behind one `EmailSender` interface:
- `console` (the default) prints emails to the server log so you can read the code while developing. Startup fails if this is used with `PROOFLENS_ENVIRONMENT=production`.
- `resend` delivers through the Resend API using `PROOFLENS_RESEND_API_KEY` and `PROOFLENS_EMAIL_FROM` (a verified sender or domain in production).
- `smtp` delivers email using `PROOFLENS_SMTP_HOST`, `_PORT`, `_USERNAME`, `_PASSWORD`, `_SECURITY` (`starttls`, `ssl` or `none`) and `PROOFLENS_EMAIL_FROM`.

Templates live in `modules/users/application/emails.py` (verification code, welcome, existing-account notice), each with an HTML and a plain-text version.

## Document uploads

Each PDF is parsed in a short-lived subprocess. It is killed after `PROOFLENS_PDF_PARSE_TIMEOUT_SECONDS` (60s), and it is capped at `PROOFLENS_PDF_WORKER_MEMORY_LIMIT_MB` of memory (1024 MB) with a matching CPU-time limit. At most `PROOFLENS_PDF_MAX_CONCURRENT_PARSES` workers (4) run at once. Extracted text is limited to `PROOFLENS_DOCUMENT_CONTENT_MAX_LENGTH` characters.

## Verification engine

`POST /api/v1/verification/` runs deterministic analysis first (claim decomposition, relevance, figures, dates, entities, negation, qualifiers), then asks the configured AI provider for strict structured output over the claim, those findings and the evidence passages, validates the output and every evidence reference against the stored passages, and aggregates both into the final verdict. The provider is selected with `PROOFLENS_AI_PROVIDER` (`gemini`, `nvidia`, `groq`, `ollama`, `none`, or empty to pick the first with credentials) behind one `InferenceProvider` interface in `modules/ai`; the verification engine never sees vendor code.

If the provider fails or returns unusable output, the deterministic engine answers alone only for a decisive case (a negation, figure, date or entity conflict with strong relevance, or a verbatim match). Otherwise the endpoint returns 503 and stores nothing, so the person can retry. Every completed verification persists its explanation, findings, references and analysis metadata, so history never depends on the provider again.
