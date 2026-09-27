// Normalises every backend failure into one shape the UI can render safely.
// The backend answers with either {detail: string | object[]} (FastAPI HTTPException / 422)
// or {error: CODE, message: string} (ProofLens domain and application errors).

export type ApiErrorKind =
  | "bad_request"
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "too_large"
  | "validation"
  | "rate_limited"
  | "server"
  | "unavailable"
  | "network";

export class ApiError extends Error {
  readonly status: number;
  readonly kind: ApiErrorKind;
  readonly code: string | null;
  /** Safe to show to a person. Never contains backend internals. */
  readonly userMessage: string;
  /** Seconds to wait, when the backend sent one (cooldowns and rate limits). */
  readonly retryAfter: number | null;
  /** Remaining one-time-code attempts, when the backend sent it. */
  readonly attemptsRemaining: number | null;

  constructor(
    status: number,
    kind: ApiErrorKind,
    userMessage: string,
    code: string | null = null,
    extra: { retryAfter?: number | null; attemptsRemaining?: number | null } = {},
  ) {
    super(userMessage);
    this.name = "ApiError";
    this.status = status;
    this.kind = kind;
    this.code = code;
    this.userMessage = userMessage;
    this.retryAfter = extra.retryAfter ?? null;
    this.attemptsRemaining = extra.attemptsRemaining ?? null;
  }
}

function intField(body: unknown, key: string): number | null {
  if (!body || typeof body !== "object") return null;
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

const KIND_BY_STATUS: Record<number, ApiErrorKind> = {
  400: "bad_request",
  401: "unauthenticated",
  403: "forbidden",
  404: "not_found",
  409: "conflict",
  413: "too_large",
  422: "validation",
  429: "rate_limited",
  500: "server",
  502: "unavailable",
  503: "unavailable",
  504: "unavailable",
};

const DEFAULT_MESSAGE: Record<ApiErrorKind, string> = {
  bad_request: "That request could not be understood. Check the form and try again.",
  unauthenticated: "Your session has expired. Log in again to continue.",
  forbidden: "You do not have access to that.",
  not_found: "That item does not exist or is no longer available.",
  conflict: "That action conflicts with the current state. Refresh and try again.",
  too_large: "That file is too large. The limit is 50 MB.",
  validation: "Some of the details are not valid. Check the form and try again.",
  rate_limited: "Too many attempts. Wait a few minutes and try again.",
  server: "Something went wrong on our side. Try again in a moment.",
  unavailable: "ProofLens is temporarily unavailable. Try again shortly.",
  network: "Could not reach ProofLens. Check your connection and try again.",
};

/** Backend messages that are safe and useful to relay as-is, keyed by status. */
function pickBackendMessage(status: number, body: unknown): string | null {
  if (status >= 500) return null;
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (typeof b.message === "string" && b.message.trim()) return b.message;
  if (typeof b.detail === "string" && b.detail.trim()) return b.detail;
  if (Array.isArray(b.detail)) {
    const first = b.detail.find((d) => d && typeof d === "object" && typeof (d as { msg?: unknown }).msg === "string") as
      | { msg: string; loc?: unknown[] }
      | undefined;
    if (first) {
      const field = Array.isArray(first.loc) ? String(first.loc[first.loc.length - 1]) : "";
      const msg = first.msg.replace(/^Value error, /, "");
      return field && field !== "body" ? `${field}: ${msg}` : msg;
    }
  }
  return null;
}

export function apiErrorFromResponse(status: number, body: unknown): ApiError {
  const kind = KIND_BY_STATUS[status] ?? (status >= 500 ? "server" : "bad_request");
  const code =
    body && typeof body === "object" && typeof (body as { error?: unknown }).error === "string"
      ? ((body as { error: string }).error)
      : null;
  // Never reveal whether an email exists: login/register wording is fixed in the auth actions.
  const message = pickBackendMessage(status, body) ?? DEFAULT_MESSAGE[kind];
  return new ApiError(status, kind, message, code, {
    retryAfter: intField(body, "retry_after"),
    attemptsRemaining: intField(body, "attempts_remaining"),
  });
}

export function networkError(): ApiError {
  return new ApiError(0, "network", DEFAULT_MESSAGE.network);
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

export function toUserMessage(e: unknown): string {
  if (isApiError(e)) return e.userMessage;
  return DEFAULT_MESSAGE.server;
}
