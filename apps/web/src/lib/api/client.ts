"use client";
// Browser-side calls go through the same-origin proxy so the token never leaves the httpOnly cookie.
import { apiErrorFromResponse, networkError, type ApiError } from "./errors";

const PROXY = "/api/prooflens";

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

export async function clientRequest<T>(
  path: string,
  init: { method?: "GET" | "POST" | "DELETE"; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${PROXY}${path}`, {
      method: init.method ?? "GET",
      headers: init.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: init.signal,
      credentials: "same-origin",
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw networkError();
  }
  if (!res.ok) throw apiErrorFromResponse(res.status, await parse(res));
  return (await parse(res)) as T;
}

export interface UploadProgress {
  loaded: number;
  total: number;
}

/** Multipart upload with progress. Resolves with the parsed backend response. */
export function uploadFile<T>(
  path: string,
  file: File,
  onProgress?: (p: UploadProgress) => void,
): { promise: Promise<T>; abort: () => void } {
  const xhr = new XMLHttpRequest();
  const promise = new Promise<T>((resolve, reject) => {
    xhr.open("POST", `${PROXY}${path}`);
    xhr.responseType = "text";
    xhr.upload.onprogress = (ev) => {
      if (onProgress && ev.lengthComputable) onProgress({ loaded: ev.loaded, total: ev.total });
    };
    xhr.onerror = () => reject(networkError());
    xhr.onabort = () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
    xhr.onload = () => {
      let body: unknown = null;
      try {
        body = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        body = null;
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(body as T);
      else reject(apiErrorFromResponse(xhr.status, body) as ApiError);
    };
    const form = new FormData();
    form.append("file", file, file.name);
    xhr.send(form);
  });
  return { promise, abort: () => xhr.abort() };
}
