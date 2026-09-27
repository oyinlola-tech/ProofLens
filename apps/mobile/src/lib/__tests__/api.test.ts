import { ApiError, errorFrom, messageOf } from "../api";

describe("errorFrom", () => {
  it("prefers the backend's message for client errors", () => {
    const e = errorFrom(403, { detail: "Confirm your email address before logging in." });
    expect(e.kind).toBe("forbidden");
    expect(e.userMessage).toBe("Confirm your email address before logging in.");
  });

  it("never shows server internals for 5xx responses", () => {
    const e = errorFrom(500, { detail: "Traceback (most recent call last)" });
    expect(e.kind).toBe("server");
    expect(e.userMessage).not.toMatch(/Traceback/);
  });

  it("reads the first validation message and drops the framework prefix", () => {
    const e = errorFrom(422, { detail: [{ msg: "Value error, Password must be at least 8 characters" }] });
    expect(e.kind).toBe("validation");
    expect(e.userMessage).toBe("Password must be at least 8 characters");
  });

  it("carries the one-time-code details the verify screen needs", () => {
    const e = errorFrom(400, { error: "OTP_INVALID", message: "That code is not correct.", attempts_remaining: 3 });
    expect(e.code).toBe("OTP_INVALID");
    expect(e.attemptsRemaining).toBe(3);
  });

  it("carries the wait time for rate limits", () => {
    expect(errorFrom(429, { error: "RATE_LIMITED", retry_after: 42 }).retryAfter).toBe(42);
  });

  it("treats gateway failures as the service being unavailable", () => {
    for (const status of [502, 503, 504]) expect(errorFrom(status, null).kind).toBe("unavailable");
  });
});

describe("messageOf", () => {
  it("uses the message of an ApiError", () => {
    expect(messageOf(new ApiError(404, "not_found", "That item does not exist."))).toBe("That item does not exist.");
  });
  it("falls back to a generic message for unknown errors", () => {
    expect(messageOf(new Error("boom"))).not.toMatch(/boom/);
  });
});
