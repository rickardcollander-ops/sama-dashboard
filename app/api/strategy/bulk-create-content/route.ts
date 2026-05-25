import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/integrations/store";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const BACKEND =
  process.env.SAMA_API_URL ||
  process.env.NEXT_PUBLIC_SAMA_API_URL ||
  "https://web-production-5324a.up.railway.app";

interface BulkItem {
  title: string;
  content_type: "blog_post" | "linkedin" | "epost";
  scheduled_date: string;
  assigned_to?: string;
  source_strategy_topic?: string;
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // The frontend passes the active site's tenant ID via X-Site-Id so pieces
  // land in the same bucket the content page will read from. Fall back to
  // user.id for backwards-compat (single-site users where site id = user id).
  const requestedSiteId = req.headers.get("x-site-id") || user.id;

  // Verify the requested site belongs to this user before using it.
  let tenantId = user.id;
  if (requestedSiteId !== user.id) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("user_sites")
      .select("id")
      .eq("id", requestedSiteId)
      .eq("user_id", user.id)
      .single();
    if (data?.id) tenantId = data.id;
  } else {
    tenantId = requestedSiteId;
  }

  const body = await req.json().catch(() => ({}));
  const items: BulkItem[] = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) {
    return NextResponse.json({ error: "items array required" }, { status: 400 });
  }

  let created = 0;
  let failed = 0;
  const pieceIds: string[] = [];

  for (const item of items) {
    if (!item.title?.trim()) { failed++; continue; }

    try {
      // Create draft piece on backend using the verified tenant ID
      const pieceRes = await fetch(`${BACKEND}/api/content/pieces`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Tenant-ID": tenantId,
          "X-Sama-Intent": "user-action",
        },
        body: JSON.stringify({
          title: item.title,
          content_type: item.content_type,
          type: item.content_type,
          status: "draft",
          source_strategy_topic: item.source_strategy_topic || item.title,
          assigned_to: item.assigned_to || undefined,
          target_keyword: item.source_strategy_topic || item.title,
        }),
      });

      let pieceId: string | undefined;
      if (pieceRes.ok) {
        const pieceData = await pieceRes.json().catch(() => ({}));
        pieceId = pieceData?.id || pieceData?.piece?.id;
        if (pieceId) pieceIds.push(pieceId);
      }

      created++;
    } catch {
      failed++;
    }
  }

  return NextResponse.json({ created, failed, piece_ids: pieceIds });
}
