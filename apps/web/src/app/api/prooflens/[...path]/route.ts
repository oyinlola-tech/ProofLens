import { NextRequest, NextResponse } from "next/server";
import { readSessionToken } from "@/lib/auth/session";
import { API_BASE } from "@/lib/api/server";

// Transport-only proxy. Attaches the httpOnly session token and forwards the request
// to the real ProofLens API. No business logic lives here.

export const dynamic = "force-dynamic";

const ALLOWED_PREFIXES = ["claims", "documents", "evidence", "verification", "auth/me"];

async function forward(req: NextRequest, ctx: RouteContext<"/api/prooflens/[...path]">) {
  const { path } = await ctx.params;
  const joined = path.join("/");
  if (!ALLOWED_PREFIXES.some((p) => joined === p || joined.startsWith(`${p}/`))) {
    return NextResponse.json({ error: "NOT_FOUND", message: "Unknown route" }, { status: 404 });
  }

  const token = await readSessionToken();
  if (!token) {
    return NextResponse.json({ error: "UNAUTHENTICATED", message: "Log in to continue." }, { status: 401 });
  }

  // Collection roots are `/claims/`, `/documents/` etc. on the backend. Next strips trailing
  // slashes from incoming URLs, so the slash is restored here instead of relying on redirects.
  const upstreamPath = path.length === 1 ? `${joined}/` : joined;
  const url = new URL(`${API_BASE}/${upstreamPath}`);
  req.nextUrl.searchParams.forEach((v, k) => url.searchParams.set(k, v));

  const headers = new Headers();
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Accept", "application/json");
  const contentType = req.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: req.method,
      headers,
      body: hasBody ? req.body : undefined,
      // Required by undici when streaming a request body.
      ...(hasBody ? { duplex: "half" as const } : {}),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { error: "SERVICE_UNAVAILABLE", message: "ProofLens is temporarily unavailable." },
      { status: 503 },
    );
  }

  const out = new Headers();
  const ct = upstream.headers.get("content-type");
  if (ct) out.set("content-type", ct);
  return new NextResponse(upstream.body, { status: upstream.status, headers: out });
}

export const GET = forward;
export const POST = forward;
export const DELETE = forward;
