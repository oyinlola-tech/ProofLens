# ProofLens pitch preparation

GOMYCODE Nigeria "Come Build with AI" Hackathon 2026. Prepared 27 Sep 2026 from the repository and a live run of the application.

Google Slides deck (10 slides, speaker notes included): https://docs.google.com/presentation/d/1QU_uGEa0TF3sWDX8m6ubZUnR5YeUzfCuszVsmE_2LjU/edit

Files in this folder:

- `ProofLens-pitch.pptx` is the same deck that was imported into Slides.
- `build_deck.py` regenerates it (`python3 build_deck.py`; needs python-pptx and Pillow).
- `screenshots/` holds the 13 real captures.
- `coffee-heart-study-sample.pdf` is the demo source document.

Status labels used below:

| Label | Meaning |
|---|---|
| **VERIFIED** | Implemented, and seen working today (test run, API call or browser) |
| **IMPLEMENTED, NOT VERIFIED** | The code exists but was not exercised today |
| **PARTIAL** | Only part of the capability exists |
| **NEXT** | Not built |

---

## 1. Executive summary

ProofLens checks whether a claim is supported by the evidence the user supplies, and explains what that evidence does and does not establish. The user enters a claim and attaches passages from uploaded documents, each with a page number. ProofLens then:

1. runs deterministic checks;
2. asks an AI model to reason over those passages only, in a strict JSON schema;
3. validates the model's output in the backend;
4. returns one of four verdicts with a confidence score, a source-grounded explanation, and "Show me why" citations down to document, page and verbatim quote.

What was verified today:

- **Tests:** 297 of 297 backend tests pass.
- **Full journey in the web app:** register → email code → claim → PDF upload → passage selection → verification → result → highlighted source → history.
- **AI providers:** Gemini, NVIDIA NIM and Groq each returned validated verdicts in live calls.

What ProofLens is not: it is not a chatbot, not a web search, not a universal truth detector, and not a replacement for human judgement. It only reasons over what the user supplies.

## 2. Verified product description

| Capability | Status | Evidence |
|---|---|---|
| Claim creation (10–10,000 chars) | VERIFIED | Browser + API. `modules/claims` |
| Document upload: PDF, TXT, MD, CSV up to 50 MB | VERIFIED (PDF) | Uploaded `coffee-heart-study-sample.pdf`, 3 pages extracted |
| Per-page text extraction, sandboxed subprocess | VERIFIED | `GET /documents/{id}/pages`; `parsers/pdf_parser.py`, `pdf_worker.py` (timeout, memory limit) |
| Evidence from a chosen page and passage, with section | VERIFIED | Passage picker, screenshot 06 |
| Paste-text evidence | IMPLEMENTED, NOT VERIFIED | `EvidencePanel.tsx`, `POST /documents/` |
| Four verdicts: supported / partially supported / contradicted / insufficient evidence | IMPLEMENTED; "contradicted" seen live | `domain/value_objects/verdict.py`; unit tests |
| Confidence, with on-screen meaning | VERIFIED | "Confidence is how strongly the supplied evidence settles this claim, not the probability that the claim is true." |
| Your claim / What the evidence says / Why it does not fully match / Unsupported portion / What the evidence does not establish / What you can conclude | VERIFIED | Result page, screenshots 09–11 |
| Deterministic checks shown to the user | VERIFIED | "Stronger language than the source: causation vs associated" |
| Show me why: quote, document, page, section, role (Supports / Conflicts) | VERIFIED | Screenshot 10 |
| Open the source: viewer at that page with the passage highlighted | VERIFIED | Screenshot 12. Shows extracted text, not the rendered PDF |
| Verification history | VERIFIED | `/app/history`, screenshot 13 |
| Account: logout, sign out everywhere | IMPLEMENTED, NOT VERIFIED | `AccountActions.tsx` |
| Mobile app (Expo): same flow, including result and Show me why | IMPLEMENTED, NOT VERIFIED | `apps/mobile`. Not run on a device today; no screenshots |
| Automatic passage suggestion | NEXT (partial code) | `documents/infrastructure/retrieval.py` exists and is unit tested, but nothing calls it |
| Passage-to-page validation | NEXT | The page and passage are supplied by the client and are not checked against the stored page text |

## 3. Verified architecture

| Layer | Details |
|---|---|
| Backend | FastAPI (Python ≥3.11), uvicorn. Modular: `users`, `claims`, `documents`, `evidence`, `verification`, `ai`, `shared`. 23 API endpoints under `/api/v1` |
| Database | PostgreSQL through async SQLAlchemy 2 and asyncpg. Alembic, 10 migration revisions. A migration test checks that upgrade matches the models and that downgrade works |
| PDF | PyMuPDF in an isolated `python -I` subprocess. 60 s timeout, 1 GB memory limit, at most 4 concurrent parses |
| Web | Next.js 16.3, React 19.3, Tailwind 4. The token is kept in an httpOnly cookie; browser calls go through a same-origin proxy |
| Mobile | Expo SDK 57, expo-router, React Native 0.86. The token is kept in SecureStore |
| AI | One `InferenceProvider` interface with Gemini (google-genai SDK), NVIDIA NIM and Groq (OpenAI-compatible, strict `json_schema`), and Ollama. The provider is chosen by `PROOFLENS_AI_PROVIDER`. Each provider has an ordered `*_FALLBACK_MODELS` list |
| Deployment | `src/Dockerfile` (non-root, production mode). There is no compose file and no CI configuration in the repository |

Neither client contains verification logic or calls an AI provider. The backend owns the verdict.

## 4. Verified AI implementation

**Providers implemented:** Gemini, NVIDIA NIM, Groq and Ollama.

**Live calls today** (`python -m scripts.check_ai`, which sends real verification requests):

| Provider | Model | Result |
|---|---|---|
| Groq | `openai/gpt-oss-120b` | OK, 3.2 s. **Active in `.env`; used for the demo run** |
| Gemini | `gemini-3.8-flash` | OK |
| Gemini | `gemini-3.5-flash` | OK once. Returned "high demand" 503 errors later; the fallback to 3.8 then answered |
| NVIDIA NIM | `nvidia/nemotron-3-super-120b-a12b` | OK, 10 s |
| NVIDIA NIM | `nvidia/nemotron-3-ultra-550b-a55b` | OK, 16 s |
| Ollama | — | Not run |

**Guarantees in the code:**

- **Structured output:** a strict JSON schema is sent to the provider, and the reply is parsed by the Pydantic model `AiVerificationResponse` (`verification/infrastructure/llm/schema.py`).
- **Retries and fallback:** malformed output is retried once per model, then the next fallback model is tried.
- **Claim and evidence are kept separate in the prompt:** each goes in its own `<claim>`, `<checks>` or `<evidence>` block, and all are declared untrusted data. `sanitize()` strips injected delimiter tags, and placeholders are expanded in a single pass (`llm/prompt.py`, `ai/domain/prompt.py`).
- **Reference validation** (`llm/provenance.py`):
  - references to passage IDs that were not supplied are dropped;
  - a quote must appear verbatim in the stored passage, otherwise it is blanked;
  - document and page always come from storage, never from the model.
- **Deterministic checks combined with AI** (`llm_engine.py: aggregate`):
  - a number, date or entity conflict overrides an AI "supported" verdict;
  - a causation or qualifier gap caps the verdict at partially supported;
  - with no valid reference, the verdict drops to insufficient evidence.
- **Failure handling:** if every model fails, ProofLens returns the deterministic verdict only when it is decisive. Otherwise it returns HTTP 503 and nothing is stored. This was verified today during the Gemini outage.

**Do not claim:**

- that NVIDIA powers the product: it works, but Groq is the active provider;
- "multi-model reasoning": only one provider answers each request; fallback is sequential;
- any accuracy figure: nothing has been benchmarked.

## 5. Verified security

| Control | Details | Code / test |
|---|---|---|
| Passwords | Argon2id (t=3, 64 MiB, p=4). Legacy PBKDF2 hashes are upgraded at login. A dummy hash equalises timing for unknown emails | `shared/infrastructure/auth.py` |
| Tokens | 32 random bytes; only the SHA-256 hash is stored. 24 h expiry. Logout, sign out everywhere, 5-session cap | `auth.py`, `users/.../routes.py` |
| Rate limits | Failed logins: 5 per email+IP and 50 per IP per 15 min. Registration: 10 per IP per hour. Failed OTP: 10 per email+IP and 50 per IP. Resend: 60 s cooldown, 10 per IP per hour. Verification emails: 3 per address per hour. Fails closed (503) | `shared/infrastructure/rate_limit.py` |
| OTP | 6 digits from `secrets`. Stored as an Argon2 hash. 10 min expiry, 5 attempts, single use; a new code cancels older ones. Registration responses do not reveal whether an email exists | `users/application/otp_service.py` |
| Ownership | Every claim, document, evidence and verification query is scoped to the owner. Another user's resource returns 404 | Repositories; `test_security.py` |
| Body limits | 1 MB, or 50 MB on `/documents`. Streamed and chunked bodies are counted too | `app/bootstrap.py` |
| Headers | nosniff, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy, COOP. HSTS and CSP in production | `bootstrap.py` |
| CORS | Explicit origins, credentials off | `settings.py` |
| Concurrency | The claim row is locked (`FOR UPDATE NOWAIT`); a second concurrent verification gets 409. Evidence used by a verification cannot be deleted (409) | `postgres_claim_repository.py` |

Security gaps, listed for honesty:

- `/verification/` (the AI call) and uploads are not rate limited.
- CSP and HSTS are only sent in production mode.

## 6. Verified testing

Run on 27 Sep 2026 against PostgreSQL 17: **297 passed, 0 failed.** ruff and mypy are clean.

| Group | Count | Notable files |
|---|---|---|
| Unit | 186 | `test_llm_engine.py` (27), `test_retrieval.py` (19), `test_deterministic_analysis.py` (18), `test_document_processing.py` (18), `test_ai_providers.py` (15) |
| Integration (real DB, ASGI app) | 111 | `test_security.py` (47), `test_email_verification.py` (22), `test_document_processing.py` (16), `test_source_grounded_verification.py` (9), `test_api.py` (9) |
| End-to-end | 0 | `tests/e2e/` is empty |
| Frontend | 0 | Neither app has test files. Web `npm run lint` is broken upstream (TypeScript 7 is not supported by typescript-eslint) |

**Fixed during this preparation:**

1. **Stale data right after a write.**
   - Cause: FastAPI 0.141 runs `yield` dependency teardown (the DB commit) after the response is sent.
   - Effect: a request sent immediately after login could get a 401.
   - Fix: `get_session` is now depended on with `scope="function"` (24 call sites).
2. **NVIDIA NIM stopped accepting `nvext.guided_json`** (every call returned HTTP 400). It now uses `response_format: json_schema`.
3. **Model fallback chain** added (`*_FALLBACK_MODELS`), with 3 new unit tests.

## 7. Screenshot inventory

All screenshots were captured today from the web app at `http://localhost:3100` against the real backend. Account: `pitch.demo@prooflens.dev`.

| # | File | Route | Shows | Use |
|---|---|---|---|---|
| 01 | `01-landing.jpg` | `/` | Marketing hero: "Claims, tested against the evidence." | Optional. The hero card beneath it is illustrative hard-coded content ("recovery-trial-2024.pdf", 72%), so do not present it as a real result |
| 02 | `02-register.jpg` | `/register` | Create account | Backup |
| 03 | `03-otp.jpg` | `/verify-email` | 6-digit code being verified | Slide 6 |
| 04 | `04-dashboard.jpg` | `/app` | Dashboard with claim composer | Backup |
| 05 | `05-claim.jpg` | `/app` | Claim typed in | Backup |
| 06 | `06-passage-picker.jpg` | `/app/claims/{id}` | Page picker with extracted page text | Backup |
| 07 | `07-evidence-attached.jpg` | `/app/claims/{id}` | Two passages attached (p.2 Results, p.3 Limitations) | Slide 6 |
| 08 | `08-verifying.jpg` | `/app/claims/{id}` | "Verifying… running deterministic checks, and reasoning" | Backup |
| 09 | `09-verdict.jpg` | `/app/verifications/{id}` | Contradicted 97%, claim chips, what the evidence says | Slide 1 |
| 10 | `10-why-show-me-why.jpg` | same | Why it does not fully match, unsupported portion, Show me why | **Hero shot**, slide 6 |
| 11 | `11-conclude-checks.jpg` | same | What you can conclude; deterministic checks; provenance line | Backup |
| 12 | `12-source-viewer.jpg` | `/app/documents/{id}?page=3&q=…` | Page 3 with the cited sentence highlighted | Slide 6 |
| 13 | `13-history.jpg` | `/app/history` | History row: Contradicted, 2 sources | Backup |

**Not captured:** the mobile app (no device or emulator was run). If you want mobile on a slide, capture it manually:

1. Run `npm run dev:mobile`.
2. Open it in Expo Go.
3. Log in with the demo account.
4. Capture History → the coffee verification → "Show me why" → "Open the source".

Note that README and `apps/web/public/images/product/result*.png` show an **older** result page. Use the screenshots in this folder instead.

## 8. Recommended demo scenario

**Claim:** "The study proves that drinking coffee every day causes a lower risk of heart disease."

**Source:** `coffee-heart-study-sample.pdf`. Page 1 labels it a sample document with fictional data.

| Page | Text |
|---|---|
| 2 (Results) | "Adults who drank two or more cups of coffee per day had an 18% lower incidence of heart disease than adults who drank none. Daily coffee consumption was associated with a lower risk of heart disease…" |
| 3 (Limitations) | "Because this was an observational study, the findings do not establish that coffee causes a lower risk of heart disease…" |

**Live result**, verification `e39ff8f6…`, Groq `openai/gpt-oss-120b`:

- **Verdict:** Contradicted, 97%.
- **Claim chips:** Absolute language · Asserts causation.
- **Deterministic checks:** "Stronger language than the source: causation vs associated", and "absolute language ('proves')".
- **Show me why:** p.2 ×2 marked **Supports**; p.3 marked **Conflicts**.

This example works well because it shows causation versus association, the source partly supporting the claim, and a conflict with a quoted page. Model wording and confidence vary between runs. This claim was verified twice today, once through the API with Gemini and once in the browser with Groq. Both runs returned "contradicted", driven by the explicit "do not establish" sentence.

## 9–12. Deck, copy, visuals and speaker notes

The complete deck is in Google Slides. Exact slide copy and full speaker notes are in each slide's notes, and are reproduced in `build_deck.py`. Summary:

| # | Title | Main message | Visual |
|---|---|---|---|
| 1 | Check what your evidence actually supports. | What ProofLens is | Title left; real verdict screenshot right (`09`) |
| 2 | A source can be real and still not say what the claim says. | The problem | Claim card → source card, key words coloured (proves/causes vs associated/do not establish); three gap types as pills |
| 3 | Claim + evidence in. An explained verdict out. | The product | Claim + Evidence → ProofLens → Verdict / **Explanation** (highlighted) / Source; four verdict pills |
| 4 | Deterministic checks and AI reasoning, with the backend owning the verdict. | How it works | Six stage cards; stages 3–5 outlined in accent; failure rule in the footer |
| 5 | Not just a label. What the source establishes, and why. | The key difference | Four columns of real output (claim / evidence says / why / conclude); Show me why quote bar with the Contradicted 97% pill |
| 6 | The running web app, captured today. | Real product | Large `10`; viewer `12`; small `07` and `03` |
| 7 | A full-stack product, not a prompt wrapper. | Technical foundation | Four columns: Backend, Clients, AI layer, Security |
| 8 | Measured today, not estimated. | Proof | 297 / 47 / 3 of 4 stat cards; end-to-end flow strip |
| 9 | The model reasons. The backend decides. | Responsible AI | Six control cards |
| 10 | From a working product to one people rely on. | Next step | Working today versus Next (not built yet); closing line |

Design: the ProofLens brand throughout. Dark #111113 surface, #FF6A3D accent, Bricolage Grotesque headings, Geist body, Geist Mono labels. No stock photos and no invented numbers.

## 13. Ninety-second version

**Problem (15 s).** "People cite real sources that do not say what they claim. A study finds an association and the claim says it proves causation. The citation looks fine; the claim is still wrong."

**Product (30 s).** "ProofLens tests a claim against the documents you supply. Here: 'The study proves coffee causes lower heart-disease risk', with the study's Results and Limitations pages. Verdict: contradicted. It says what the evidence does establish, which is an association, and why the claim does not match: the study is observational and says it cannot establish causation. Show me why opens page 3 with that exact sentence highlighted."

**Proof (30 s).** "The backend owns the verdict. Deterministic checks catch number, date, name, negation and causation gaps. The AI only sees your passages, must answer in a strict schema, and cannot invent citations, because we validate every reference. 297 backend tests pass today, including 47 security tests. Gemini, NVIDIA and Groq all work behind one interface."

**Next (15 s).** "Next: suggest the relevant passages automatically, and check that each passage really appears on its page. ProofLens helps people say exactly what their evidence supports, and show the page that proves it."

## 26. Live demo script (about 2 minutes)

**Preparation, before judging:**

1. Start Postgres. The dev container is `betng-postgres` on port 55432.
2. Start the backend: `npm run backend`. Confirm `PROOFLENS_AI_PROVIDER=groq` in `src/.env`, then run `cd src && .venv/bin/python -m scripts.check_ai`. It must print `OK`.
3. Start the web app: `npm run web`. Port 3000 on this machine is currently taken by another app, so use `npx next dev -p 3100` in `apps/web`.
4. Log in with the demo account `pitch.demo@prooflens.dev`. The password was generated today and is stored locally, outside the repo. Alternatively, register a fresh account; with `EMAIL_BACKEND=console` the 6-digit code is printed in the backend console.
5. Pre-create the claim and attach both passages so the live path is short. Keep the finished result from today (`/app/history` → the coffee row) open in a second tab as a fallback.

**Live path:**

1. Open `/app/claims` and select "The study proves that drinking coffee…".
2. Point at the two attached passages: page 2 Results, page 3 Limitations.
3. Click **Verify this claim**. It takes about 10 s with Groq.
4. Verdict card: **Contradicted**, with the confidence note.
5. **What the evidence says**: association, 18% lower incidence, observational.
6. **Why the claim does not fully match** and the **Unsupported portion**.
7. **Show me why**: page 3 is marked **Conflicts**, the page 2 passages are marked **Supports**.
8. Click **Open the source** on the page-3 card: the viewer opens at page 3 with the sentence highlighted.
9. Optionally, back on the result page, scroll to **Deterministic checks**: causation vs associated.

If the AI provider is down, the app shows "Verification unavailable… no verdict was produced". Say so honestly, then switch to the fallback tab.

## 27. AI and tool disclosure (draft; confirm with the team)

- **AI inside the product:** large language models reason over user-supplied passages and return a structured verdict. The provider is configurable. Verified live today: Groq (`openai/gpt-oss-120b`, active), Google Gemini (`gemini-3.5-flash`, `gemini-3.8-flash`) and NVIDIA NIM (`nvidia/nemotron-3-super-120b-a12b`, `nvidia/nemotron-3-ultra-550b-a55b`). An Ollama adapter exists but was not used.
- **How AI is combined with deterministic logic:** rule-based checks run first. The model's JSON is validated with Pydantic. Citations are checked against stored passages. Hard deterministic conflicts override the model. The backend, not the model, decides the final verdict.
- **AI coding tools:** Claude Code (Anthropic) was used in this session for provider wiring, the fallback chain, bug fixes, testing and this pitch material. The repository includes `CLAUDE.md` and `AGENTS.md` files, which suggests agent-assisted development. **The team should list any other tools they used.**

## 28. Fact verification table

| Claim | Slide | Source | Verified? | Status |
|---|---|---|---|---|
| Four verdicts | 3 | `verdict.py`; UI pills | Code + UI | Keep |
| Evidence from PDF/TXT/MD/CSV, by page | 3, 4 | `documents/.../routes.py`; upload today | PDF live; others in code | Keep |
| Isolated subprocess PDF extraction | 4, 7 | `pdf_parser.py`, `pdf_worker.py`; `test_subprocess_pdf_parser.py` | Code + tests | Keep |
| Number, date, entity, negation, causation checks | 4 | `deterministic_analysis.py`; 18 tests | Code + tests; causation seen live | Keep |
| Strict JSON schema + Pydantic | 4, 9 | `schema.py`, `openai_compat.py`, `gemini.py` | Code + tests + live | Keep |
| Unknown references dropped; quotes must be verbatim | 4, 9 | `provenance.py`; `test_llm_engine.py` | Code + tests | Keep |
| Hard conflicts override the model | 4, 9 | `llm_engine.py: aggregate`; `test_numeric_mismatch_overrides_ai_support` | Code + tests | Keep. Negation only caps confidence; the slide does not claim it flips the verdict |
| Honest failure / nothing stored | 4, 9 | `verify_claim.py`; `test_source_grounded_verification.py`; Gemini outage today | Code + tests + live | Keep |
| Coffee example output text | 5 | Verification `e39ff8f6…`, page text | Live | Keep (model wording varies) |
| Screens are the real app | 6 | Screenshots 03, 07, 10, 12 | Live | Keep |
| FastAPI, PostgreSQL, SQLAlchemy 2, Alembic (10) | 7 | `pyproject.toml`, `migrations/versions` | Code | Keep |
| Next.js 16, React 19, Expo SDK 57 | 7 | `package.json` files | Code | Keep |
| Four providers, config-selected, fallback models | 7 | `ai/infrastructure/factory.py`, `settings.py` | Code; 3 live | Keep |
| Argon2id, hashed tokens, revocation, 5-session cap, 24 h | 7 | `auth.py`, `routes.py`; `test_security.py` | Code + tests | Keep |
| 297 backend tests passing (186 + 111) | 8 | pytest run today | Run | Keep |
| 47 security tests | 8 | `test_security.py` collection | Run | Keep |
| 3 of 4 providers verified live | 8 | `scripts/check_ai.py` runs | Live | Keep |
| End-to-end web run | 8 | Screenshots 02–13 | Live | Keep |
| Prompt-injection guard | 9 | `prompt.py`; `test_evidence_cannot_break_out…`; integration test | Code + tests | Keep. Do not claim it is "injection-proof" |
| Ranking code exists but is not wired in | 10 | `retrieval.py`; no callers | Code | Keep, labelled Next |
| Mobile app | 7 | `apps/mobile` | Code only | Mentioned as a stack item only; not shown working |

## 16. Known limitations

- No frontend tests, and no e2e tests (`tests/e2e/` is empty). Web lint is broken upstream.
- The mobile app was not run today, and there are no native screenshots. The mobile icon and splash are Expo template defaults.
- Evidence page and passage come from the client and are not checked against the stored page text.
- A negation conflict caps the AI's confidence but does not flip an AI "supported" verdict.
- No rate limit on `/verification/` (the AI call) or on uploads.
- `google-genai` and `resend` are used but not declared in `pyproject.toml`, so the Docker image would fail with Gemini or Resend.
- The viewer highlights extracted text, not the original PDF layout.
- No accuracy benchmark exists; do not quote accuracy.
- The README is partly stale: it mentions a confirmation link (the code uses a 6-digit code), lists `meta/llama-3.1-8b-instruct`/`guided_json` for NVIDIA, and says "NVIDIA NIM today". The marketing pages contain illustrative hard-coded examples, such as the 72% hero card.
- The Gemini free tier returned "high demand" 503 errors during testing; Groq is the active provider for the demo.

## 17. Future roadmap (all NEXT, not built)

1. Suggest relevant passages automatically (wire in `retrieval.py`).
2. Validate that each passage appears on its cited page.
3. Decompose multi-part claims and verify each part.
4. Web and mobile test suites; an accuracy benchmark on labelled claim/evidence pairs.
5. Fallback across providers, not only across models within one provider.
6. Rate limiting on verification and upload.

## 18. Final presentation checklist

- [ ] Postgres, backend and web are running; `scripts.check_ai` prints OK.
- [ ] You can log in as the demo account; the coffee claim has both passages attached.
- [ ] A fallback tab is open on today's finished result.
- [ ] The deck opens in Slideshow and the speaker notes are visible in presenter view.
- [ ] No slide claims accuracy, users, traction, or a mobile screenshot.
- [ ] Say "sample document, fictional data" when showing the PDF.
- [ ] Say "one provider at a time, configurable", not "multi-model".
- [ ] The team has confirmed the AI coding-tool disclosure.
- [ ] Rehearse the 90-second version to time.
