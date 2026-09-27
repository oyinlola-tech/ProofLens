import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const TOKEN_KEY = "prooflens.session";

function resolveBase(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  // Derive the dev machine host from the Expo dev server so physical devices and emulators both work.
  const hostUri = Constants.expoConfig?.hostUri;
  const host = hostUri ? hostUri.split(":")[0] : Platform.OS === "android" ? "10.0.2.2" : "127.0.0.1";
  return `http://${host}:8000/api/v1`;
}

export const API_BASE = resolveBase();

export type ApiErrorKind =
  | "bad_request" | "unauthenticated" | "forbidden" | "not_found" | "conflict"
  | "too_large" | "validation" | "rate_limited" | "server" | "unavailable" | "network";

export class ApiError extends Error {
  constructor(
    public status: number,
    public kind: ApiErrorKind,
    public userMessage: string,
    public code: string | null = null,
    public retryAfter: number | null = null,
    public attemptsRemaining: number | null = null,
  ) {
    super(userMessage);
    this.name = "ApiError";
  }
}

function intField(body: unknown, key: string): number | null {
  if (!body || typeof body !== "object") return null;
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

const KIND: Record<number, ApiErrorKind> = { 400: "bad_request", 401: "unauthenticated", 403: "forbidden", 404: "not_found", 409: "conflict", 413: "too_large", 422: "validation", 429: "rate_limited", 500: "server", 502: "unavailable", 503: "unavailable", 504: "unavailable" };

const DEFAULT: Record<ApiErrorKind, string> = {
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

function backendMessage(status: number, body: unknown): string | null {
  if (status >= 500 || !body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (typeof b.message === "string" && b.message.trim()) return b.message;
  if (typeof b.detail === "string" && b.detail.trim()) return b.detail;
  if (Array.isArray(b.detail)) {
    const first = b.detail.find((d) => d && typeof d === "object" && typeof (d as { msg?: unknown }).msg === "string") as { msg: string } | undefined;
    if (first) return first.msg.replace(/^Value error, /, "");
  }
  return null;
}

export function errorFrom(status: number, body: unknown): ApiError {
  const kind = KIND[status] ?? (status >= 500 ? "server" : "bad_request");
  const code = body && typeof body === "object" && typeof (body as { error?: unknown }).error === "string" ? (body as { error: string }).error : null;
  return new ApiError(status, kind, backendMessage(status, body) ?? DEFAULT[kind], code, intField(body, "retry_after"), intField(body, "attempts_remaining"));
}

export function messageOf(e: unknown): string {
  return e instanceof ApiError ? e.userMessage : DEFAULT.server;
}

// SecureStore is native-only. On Expo Web (used for previews) the token falls back to sessionStorage.
const webStore = Platform.OS === "web" && typeof sessionStorage !== "undefined" ? sessionStorage : null;

export async function getToken(): Promise<string | null> {
  try {
    if (webStore) return webStore.getItem(TOKEN_KEY);
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setToken(token: string | null): Promise<void> {
  if (webStore) {
    if (token) webStore.setItem(TOKEN_KEY, token);
    else webStore.removeItem(TOKEN_KEY);
    return;
  }
  if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

type Listener = () => void;
const expiryListeners = new Set<Listener>();
export function onSessionExpired(l: Listener): () => void {
  expiryListeners.add(l);
  return () => expiryListeners.delete(l);
}

async function parse(res: Response): Promise<unknown> {
  if (res.status === 204) return null;
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

interface Options {
  method?: "GET" | "POST" | "DELETE";
  body?: unknown;
  form?: FormData;
  anonymous?: boolean;
  signal?: AbortSignal;
}

export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (!opts.anonymous) {
    const token = await getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: opts.method ?? "GET",
      headers,
      body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
      signal: opts.signal,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiError(0, "network", DEFAULT.network);
  }
  if (!res.ok) {
    const err = errorFrom(res.status, await parse(res));
    if (err.status === 401 && !opts.anonymous) {
      await setToken(null);
      expiryListeners.forEach((l) => l());
    }
    throw err;
  }
  return (await parse(res)) as T;
}

/** Upload a picked file. React Native's fetch accepts {uri, name, type} entries in FormData. */
export function uploadDocument<T>(file: { uri: string; name: string; mimeType?: string | null }): Promise<T> {
  const form = new FormData();
  form.append("file", { uri: file.uri, name: file.name, type: file.mimeType ?? "application/octet-stream" } as unknown as Blob);
  return api<T>("/documents/upload", { method: "POST", form });
}
