import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const SAMA_BACKEND_URL =
  process.env.SAMA_API_URL ||
  process.env.NEXT_PUBLIC_SAMA_API_URL ||
  "https://web-production-5324a.up.railway.app";

function backendHeaders(siteId: string, accessToken: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "X-Tenant-ID": siteId,
    "X-Sama-Site-Id": siteId,
    "X-Sama-Account-Id": siteId,
    "X-Sama-Intent": "user-action",
    Authorization: `Bearer ${accessToken}`,
  };
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => ({}));
  const siteId = typeof body.siteId === "string" ? body.siteId.trim() : "";
  if (!siteId) {
    return NextResponse.json({ error: "siteId required" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token ?? "";
  if (!accessToken) {
    return NextResponse.json({ error: "No active session" }, { status: 401 });
  }

  const headers = backendHeaders(siteId, accessToken);
  const errors: string[] = [];
  let deletedPieces = 0;
  let deletedPlan = 0;

  // Fetch all content pieces for this tenant
  try {
    const piecesRes = await fetch(`${SAMA_BACKEND_URL}/api/content/pieces`, {
      headers,
      signal: AbortSignal.timeout(30_000),
    });
    if (piecesRes.ok) {
      const data = await piecesRes.json().catch(() => ({})) as { pieces?: { id: string }[] };
      const pieces = data.pieces ?? [];
      for (const piece of pieces) {
        const del = await fetch(`${SAMA_BACKEND_URL}/api/content/pieces/${piece.id}`, {
          method: "DELETE",
          headers,
          signal: AbortSignal.timeout(10_000),
        });
        if (del.ok) deletedPieces++;
        else errors.push(`piece ${piece.id}: HTTP ${del.status}`);
      }
    } else {
      errors.push(`GET /api/content/pieces: HTTP ${piecesRes.status}`);
    }
  } catch (e) {
    errors.push(`pieces fetch failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Bulk-delete any remaining archived pieces and plan items. Best-effort —
  // failures here shouldn't abort the operation, but they must still be
  // surfaced in `errors[]` rather than silently dropped.
  try {
    const archivedPiecesRes = await fetch(`${SAMA_BACKEND_URL}/api/content/pieces/archived`, {
      method: "DELETE",
      headers,
      signal: AbortSignal.timeout(15_000),
    });
    if (archivedPiecesRes.ok) deletedPieces++;
    else errors.push(`DELETE /api/content/pieces/archived: HTTP ${archivedPiecesRes.status}`);
  } catch (e) {
    errors.push(`archived pieces delete failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  try {
    const archivedPlanRes = await fetch(`${SAMA_BACKEND_URL}/api/content/plan/archived`, {
      method: "DELETE",
      headers,
      signal: AbortSignal.timeout(15_000),
    });
    if (archivedPlanRes.ok) deletedPlan++;
    else errors.push(`DELETE /api/content/plan/archived: HTTP ${archivedPlanRes.status}`);
  } catch (e) {
    errors.push(`archived plan delete failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Reset onboarding flag in user_sites so the customer can re-onboard
  const { admin } = guard;
  const { data: siteRow } = await admin
    .from("user_sites")
    .select("settings")
    .eq("id", siteId)
    .maybeSingle();

  if (siteRow) {
    const settings = (siteRow.settings as Record<string, unknown>) ?? {};
    const { onboarding_completed_at: _removed, ...rest } = settings;
    await admin
      .from("user_sites")
      .update({ settings: rest, updated_at: new Date().toISOString() })
      .eq("id", siteId);
  }

  return NextResponse.json({
    ok: true,
    deletedPieces,
    deletedPlan,
    errors: errors.length > 0 ? errors : undefined,
  });
}
