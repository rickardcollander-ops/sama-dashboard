import { NextRequest, NextResponse } from "next/server";
import { getAdapter } from "@/lib/integrations/cms";
import { CmsKind } from "@/lib/integrations/cms/types";
import { getCurrentUser } from "@/lib/integrations/store";
import { assertPublicHttpUrl } from "@/lib/security/url-guard";

// Config keys across adapters that hold a URL forwarded to validate(). Only
// these are checked here — adapters that build fetch targets out of
// non-URL fields (e.g. shop_domain, store_hash) guard themselves.
const URL_CONFIG_KEYS = ["site_url", "api_url", "url"];

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const kind = body.kind as CmsKind;
  const config = (body.config || {}) as Record<string, string>;

  for (const key of URL_CONFIG_KEYS) {
    const value = config[key];
    if (!value) continue;
    let candidate = value.trim();
    if (!/^https?:\/\//i.test(candidate)) candidate = `https://${candidate}`;
    try {
      assertPublicHttpUrl(candidate);
    } catch (e) {
      return NextResponse.json(
        { ok: false, message: e instanceof Error ? e.message : "Invalid URL" },
        { status: 400 },
      );
    }
  }

  try {
    const adapter = getAdapter(kind);
    if (!adapter.validate) {
      return NextResponse.json({ ok: true, message: "no validation available" });
    }
    const result = await adapter.validate(config);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "validation error" }, { status: 400 });
  }
}
