"use server";

import { redirect } from "next/navigation";
import { apiRequest } from "@/lib/api/server";
import { isApiError, toUserMessage } from "@/lib/api/errors";
import type { AuthResponse, VerificationPending } from "@/lib/api/types";
import { clearSessionToken, readSessionToken, writeSessionToken } from "./session";

export type OtpErrorCode = "OTP_INVALID" | "OTP_EXPIRED" | "OTP_ATTEMPTS_EXCEEDED" | "RATE_LIMITED";

export interface AuthFormState {
  error?: string;
  fieldErrors?: { email?: string; password?: string; otp?: string };
  values?: { email: string };
  /** Login only: the account exists but the email is not confirmed yet. */
  needsConfirmation?: boolean;
  /** Register / resend: the backend accepted the request and an email is on its way. */
  sent?: boolean;
  /** Verify-email: which backend state the rejection maps to. */
  code?: OtpErrorCode;
  attemptsRemaining?: number;
  /** Resend: seconds the client must wait before the next code can be requested. */
  retryAfter?: number;
  cooldown?: number;
  /** Increments on every accepted resend so the form can restart its timer. */
  sentAt?: number;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function safeNext(raw: FormDataEntryValue | null): string {
  const s = typeof raw === "string" ? raw : "";
  return s.startsWith("/app") ? s : "/app";
}

function validate(email: string, password: string): AuthFormState["fieldErrors"] | null {
  const errs: NonNullable<AuthFormState["fieldErrors"]> = {};
  if (!EMAIL_RE.test(email)) errs.email = "Enter a valid email address.";
  if (password.length < 8) errs.password = "Use at least 8 characters.";
  if (password.length > 128) errs.password = "Use at most 128 characters.";
  return Object.keys(errs).length ? errs : null;
}

export async function loginAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));
  const fieldErrors = validate(email, password);
  if (fieldErrors) return { fieldErrors, values: { email } };

  try {
    const auth = await apiRequest<AuthResponse>("/auth/login", {
      method: "POST",
      body: { email, password },
      anonymous: true,
    });
    await writeSessionToken(auth.token);
  } catch (e) {
    if (isApiError(e) && e.status === 401) {
      return { error: "Email or password is incorrect.", values: { email } };
    }
    if (isApiError(e) && e.status === 403) {
      return { needsConfirmation: true, values: { email } };
    }
    return { error: toUserMessage(e), values: { email } };
  }
  redirect(next);
}

export async function registerAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const fieldErrors = validate(email, password);
  if (fieldErrors) return { fieldErrors, values: { email } };

  let pending: VerificationPending;
  try {
    pending = await apiRequest<VerificationPending>("/auth/register", {
      method: "POST",
      body: { email, password },
      anonymous: true,
    });
  } catch (e) {
    return { error: toUserMessage(e), values: { email } };
  }
  redirect(`/verify-email?email=${encodeURIComponent(email)}&sent=1&cooldown=${pending.resend_cooldown_seconds}`);
}

export async function resendVerificationAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { fieldErrors: { email: "Enter a valid email address." }, values: { email } };
  try {
    const pending = await apiRequest<VerificationPending>("/auth/resend-verification", {
      method: "POST",
      body: { email },
      anonymous: true,
    });
    return { sent: true, values: { email }, cooldown: pending.resend_cooldown_seconds, sentAt: Date.now() };
  } catch (e) {
    if (isApiError(e) && e.status === 429) {
      const retryAfter = e.retryAfter ?? undefined;
      return {
        error: retryAfter ? `Please wait ${retryAfter} seconds before requesting a new code.` : e.userMessage,
        code: "RATE_LIMITED",
        retryAfter,
        values: { email },
      };
    }
    return { error: toUserMessage(e), values: { email } };
  }
}

export async function verifyOtpAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const otp = String(formData.get("otp") ?? "").trim();
  if (!EMAIL_RE.test(email)) return { fieldErrors: { email: "Enter a valid email address." }, values: { email } };
  if (!/^[0-9]{4,10}$/.test(otp)) return { fieldErrors: { otp: "Enter the numeric code from your email." }, values: { email } };
  try {
    const auth = await apiRequest<AuthResponse>("/auth/verify-otp", {
      method: "POST",
      body: { email, otp },
      anonymous: true,
    });
    await writeSessionToken(auth.token);
  } catch (e) {
    if (isApiError(e)) {
      const code = e.code as OtpErrorCode | null;
      if (code === "OTP_EXPIRED") return { code, error: "That code has expired. Request a new one below.", values: { email } };
      if (code === "OTP_ATTEMPTS_EXCEEDED") return { code, error: "Too many incorrect attempts. Request a new code below.", values: { email } };
      if (code === "OTP_INVALID") {
        const remaining = e.attemptsRemaining;
        return {
          code,
          attemptsRemaining: remaining ?? undefined,
          error: remaining !== null && remaining !== undefined ? `That code is not correct. ${remaining} ${remaining === 1 ? "attempt" : "attempts"} left.` : "That code is not correct. Check the email and try again.",
          values: { email },
        };
      }
      if (e.status === 429) return { code: "RATE_LIMITED", error: "Too many attempts. Wait a few minutes before trying again.", values: { email } };
    }
    return { error: toUserMessage(e), values: { email } };
  }
  redirect("/app?welcome=1");
}

export async function logoutAction(): Promise<void> {
  const token = await readSessionToken();
  if (token) {
    try {
      await apiRequest("/auth/logout", { method: "POST", body: { token }, token });
    } catch {
      // The cookie is cleared regardless; the token expires server-side within 24h.
    }
  }
  await clearSessionToken();
  redirect("/");
}

export async function revokeAllSessionsAction(): Promise<void> {
  try {
    await apiRequest("/auth/revoke-all", { method: "POST" });
  } catch {
    // Fall through: clearing the local cookie is still the right outcome.
  }
  await clearSessionToken();
  redirect("/login?reason=revoked");
}
