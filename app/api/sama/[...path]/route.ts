import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BACKEND =
  process.env.SAMA_API_URL ||
  process.env.NEXT_PUBLIC_SAMA_API_URL ||
  "https://web-production-5324a.up.railway.app";

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
]);

function copyRequestHeaders(src: Headers): Headers {
  const out = new Headers();
  src.forEach((value, key) => {
    if (HOP_BY_HOP.has(key.toLowerCase())) return;
    out.set(key, value);
  });
  return out;
}

function copyResponseHeaders(src: Headers): Headers {
  const out = new Headers();
  src.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (HOP_BY_HOP.has(lower)) return;
    if (lower === "content-encoding") return;
    if (lower.startsWith("access-control-")) return;
    out.set(key, value);
  });
  return out;
}

async function handle(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  if (!path || path.length === 0) {
    return NextResponse.json({ error: "missing path" }, { status: 400 });
  }
  const url = new URL(req.url);
  const target = `${BACKEND.replace(/\/$/, "")}/${path.join("/")}${url.search}`;

  const init: RequestInit = {
    method: req.method,
    headers: copyRequestHeaders(req.headers),
    redirect: "manual",
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    const body = await req.arrayBuffer();
    if (body.byteLength > 0) init.body = body;
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch (e) {
    return NextResponse.json(
      {
        error: "Upstream unreachable",
        detail: e instanceof Error ? e.message : String(e),
        target,
      },
      { status: 502 },
    );
  }

  const respHeaders = copyResponseHeaders(upstream.headers);
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: respHeaders,
  });
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const HEAD = handle;
export const OPTIONS = handle;
