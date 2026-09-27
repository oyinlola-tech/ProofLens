import "server-only";
import { cookies } from "next/headers";

// The bearer token lives only in an httpOnly cookie. Browser JavaScript never sees it.
export const SESSION_COOKIE = "pl_session";
const MAX_AGE_SECONDS = 60 * 60 * 24; // matches AUTH_TOKEN_EXPIRY_HOURS=24

export async function readSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

export async function writeSessionToken(token: string): Promise<void> {
  const store = await cookies();
  const isProduction = process.env.NODE_ENV === "production";
  const secure = process.env.PROOFLENS_SECURE_COOKIES === "true" || isProduction;
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearSessionToken(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
