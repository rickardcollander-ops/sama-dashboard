import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/integrations/store";
import {
  getTenantSettingsAccess,
  resolveSiteId,
} from "@/lib/integrations/site-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BACKEND =
  process.env.SAMA_API_URL ||
  process.env.NEXT_PUBLIC_SAMA_API_URL ||
  "https://web-production-5324a.up.railway.app";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const propertyId = body?.property_id;
  if (!propertyId || typeof propertyId !== "string") {
    return NextResponse.json({ error: "property_id is required" }, { status: 400 });
  }

  const siteId = resolveSiteId(req, user.id);
  let access;
  try {
    access = await getTenantSettingsAccess(user, siteId);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not load tenant settings" },
      { status: 500 },
    );
  }

  try {
    await access.save({ ...access.settings, ga4_property_id: propertyId });
  } catch (e) {
    return NextResponse.json(
      { detail: `Could not save property: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    );
  }

  // Best-effort forward to backend so it can update its own cache.
  // We ignore errors here — the Supabase save above is authoritative.
  const accountId = req.headers.get("X-Sama-Account-Id") || user.id;
  fetch(`${BACKEND}/api/integrations/google/analytics/select-property`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Sama-Account-Id": accountId,
      "X-Sama-Site-Id": siteId,
      "X-Tenant-ID": siteId,
      "X-Sama-Intent": "user-action",
    },
    body: JSON.stringify({ property_id: propertyId }),
    signal: AbortSignal.timeout(5000),
  }).catch(() => undefined);

  return NextResponse.json({ property_id: propertyId, saved: true });
}
