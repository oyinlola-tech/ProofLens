# Security policy

ProofLens handles user accounts, uploaded documents and AI provider keys. This file explains how to report a vulnerability and summarises the security controls the code actually implements.

## Supported versions

ProofLens is pre-1.0. Security fixes are made on the `main` branch only.

| Version | Supported |
| --- | --- |
| `main` (0.1.x) | Yes |
| Anything older | No |

## Reporting a vulnerability

**Please do not open a public issue for a security problem.**

Report it privately through GitHub: go to [the repository's Security tab](https://github.com/oyinlola-tech/ProofLens/security) and choose **Report a vulnerability**.

Please include:

- what is affected (endpoint, screen or file) and the commit you tested;
- steps to reproduce, or a minimal proof of concept;
- the impact you expect (for example: read another user's documents, bypass the sign-up code, extract secrets);
- whether the issue is already public anywhere.

What to expect:

- an acknowledgement, aiming for within 5 working days;
- an assessment and a fix plan, shared in the private advisory;
- credit in the advisory once a fix is released, unless you prefer to stay anonymous.

### Testing guidelines

- Test only against your own local instance or accounts you control.
- Do not access, change or delete other people's data, and do not run denial-of-service or load tests against shared deployments.
- Do not submit real secrets or personal data in your report. Use redacted values.

## Scope

In scope:

- the FastAPI backend (`src/`);
- the Next.js web app (`apps/web`) and its API proxy;
- the Expo mobile app (`apps/mobile`);
- how AI output is validated before it reaches a user.

Out of scope:

- vulnerabilities in third-party services (Gemini, NVIDIA NIM, Groq, Resend) themselves;
- findings that need a compromised server or developer machine;
- missing hardening that is already listed under [Known gaps](#known-gaps).

## Security controls in the code

| Area | What is implemented | Where |
| --- | --- | --- |
| Passwords | Argon2id (time cost 3, 64 MiB memory, parallelism 4). Legacy PBKDF2 hashes are rehashed on login. A dummy hash keeps timing the same for unknown emails. | `src/shared/infrastructure/auth.py` |
| Sessions | 32 random bytes per token; only the SHA-256 hash is stored. 24-hour expiry, logout, sign out everywhere, and at most 5 sessions per user. | `auth.py`, `src/modules/users/presentation/http/routes.py` |
| Email verification | 6-digit codes from `secrets`, stored as Argon2 hashes. They expire after 10 minutes, allow 5 attempts, are single use, and are replaced when a new one is sent. Registration does not reveal whether an email exists. | `src/modules/users/application/otp_service.py` |
| Rate limiting | PostgreSQL-backed and failing closed (503). Failed logins are limited per email+IP and per IP. Also limited: registrations per IP, failed codes, resend (60-second cooldown), and verification emails per address. | `src/shared/infrastructure/rate_limit.py` |
| Authorisation | Every claim, document, evidence and verification query is scoped to its owner. Another user's resource returns 404. | module repositories |
| Request limits | Bodies are capped at 1 MB, or 50 MB on document routes. Chunked and streamed bodies are counted. | `src/app/bootstrap.py` |
| File handling | Type allow-list. PDFs are parsed in an isolated subprocess with a 60 s timeout, a 1 GB memory limit and a concurrency cap. | `src/modules/documents/infrastructure/parsers/` |
| Headers and CORS | nosniff, `X-Frame-Options: DENY`, Referrer-Policy, Permissions-Policy, COOP. HSTS and CSP are added in production. CORS allows only explicit origins, without credentials. | `bootstrap.py`, `src/app/settings.py` |
| AI output | Claim and evidence are sent as delimited, untrusted data, and injected delimiter tags are stripped. Output must match a strict JSON schema validated with Pydantic. References to passages that were not supplied are dropped. Quotes must appear verbatim in the stored text. Document and page always come from the database. A provider failure never becomes an invented verdict. | `src/modules/verification/infrastructure/llm/` |
| Clients | Web: the token is in an httpOnly cookie behind a same-origin proxy with an allow-list. Mobile: the token is in SecureStore. No provider or email keys ship to either client. | `apps/web/src/lib/auth/`, `apps/mobile/src/lib/api.ts` |
| Container | The Docker image runs as a non-root user (uid 10001). | `src/Dockerfile` |

Most of these controls are covered by `src/tests/integration/test_security.py` (47 tests) and `test_email_verification.py` (22 tests).

## Known gaps

These are known and planned. Please do not report them as new findings.

- `POST /verification/` (the AI call) and document uploads are not rate limited.
- The page and passage of a piece of evidence are chosen by the client and are not yet checked against the stored page text.
- CSP and HSTS are only sent when `PROOFLENS_ENVIRONMENT=production`.
- The web cookie is marked `Secure` only in production or when `PROOFLENS_SECURE_COOKIES=true`.
- The web and mobile apps have no automated tests.

## Handling secrets

- Keep real keys only in `src/.env`, which is git-ignored. `src/.env.example` must hold placeholders only.
- `PROOFLENS_EMAIL_BACKEND=console` prints sign-up codes to the log. It is refused in production; use it only for local development.
- If a key is exposed, rotate it with the provider first, then update `.env` and restart the backend.
