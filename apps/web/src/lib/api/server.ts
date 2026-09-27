import "server-only";
import { redirect } from "next/navigation";
import { readSessionToken } from "@/lib/auth/session";
import { apiErrorFromResponse, networkError, ApiError } from "./errors";

const BASE = (process.env.PROOFLENS_API_URL ?? "http://127.0.0.1:8000/api/v1").replace(/\/$/, "");

interface RequestOptions {
  method?: "GET" | "POST" | "DELETE";
  body?: unknown;
  /** Send without the session cookie (login, register). */
  anonymous?: boolean;
  /** Bearer token override, used right after login before the cookie is written. */
  token?: string | null;
  /** When true, a 401 redirects to /login instead of throwing. Use inside page renders. */
  redirectOnExpiry?: boolean;
}

async function parseBody(res: Response): Promise<unknown> {
  if (res.status === 204) return null;
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function apiRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const token = opts.anonymous ? null : (opts.token ?? (await readSessionToken()));
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw networkError();
  }

  if (!res.ok) {
    const body = await parseBody(res);
    const err = apiErrorFromResponse(res.status, body);
    if (err.status === 401 && opts.redirectOnExpiry) {
      redirect("/login?reason=expired");
    }
    throw err;
  }
  return (await parseBody(res)) as T;
}

/** Page-render helper: returns null on 404 so pages can call notFound(). */
export async function apiGetOrNull<T>(path: string): Promise<T | null> {
  try {
    return await apiRequest<T>(path, { redirectOnExpiry: true });
  } catch (e) {
    if (e instanceof ApiError && e.kind === "not_found") return null;
    throw e;
  }
}

export { BASE as API_BASE };
