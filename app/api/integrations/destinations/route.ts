import { NextRequest, NextResponse } from "next/server";
import {
  deleteDestination,
  getCurrentUser,
  getDestinations,
  resolveSiteId,
  upsertDestination,
} from "@/lib/integrations/store";
import { CmsKind } from "@/lib/integrations/cms/types";
import { SUPPORTED_KINDS, getAdapter } from "@/lib/integrations/cms";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const siteId = resolveSiteId(req, user.id);
  const destinations = await getDestinations(siteId, user.id);
  const safe = destinations.map((d) => ({
    ...d,
    config: maskConfig(d.config),
  }));
  return NextResponse.json({ destinations: safe });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const siteId = resolveSiteId(req, user.id);
  const body = await req.json().catch(() => ({}));

  const kind = body.kind as CmsKind;
  const name = (body.name || "").toString().trim();
  const config = (body.config || {}) as Record<string, string>;
  if (!SUPPORTED_KINDS.includes(kind)) {
    return NextResponse.json({ error: "unknown kind" }, { status: 400 });
  }
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  if (body.validate !== false) {
    try {
      const adapter = getAdapter(kind);
      if (adapter.validate) {
        const v = await adapter.validate(config);
        if (!v.ok) {
          return NextResponse.json({ error: v.message || "validation failed" }, { status: 400 });
        }
      }
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "validation error" }, { status: 400 });
    }
  }

  const dest = await upsertDestination(siteId, user.id, { id: body.id, kind, name, config });
  return NextResponse.json({ destination: { ...dest, config: maskConfig(dest.config) } });
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const siteId = resolveSiteId(req, user.id);
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await deleteDestination(siteId, user.id, id);
  return NextResponse.json({ ok: true });
}

const SECRET_KEYS = new Set([
  "app_password",
  "api_token",
  "admin_api_key",
  "integration_token",
  "bearer_token",
  "secret",
  "access_token",
  "api_key",
  "api_pass",
]);

function maskConfig(config: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(config || {})) {
    if (SECRET_KEYS.has(k) && v) {
      out[k] = `••••${v.slice(-4)}`;
    } else {
      out[k] = v;
    }
  }
  return out;
}
