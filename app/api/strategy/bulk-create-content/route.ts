import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/integrations/store";
import { appendScheduled, getDestinations } from "@/lib/integrations/store";

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

  const body = await req.json().catch(() => ({}));
  const items: BulkItem[] = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) {
    return NextResponse.json({ error: "items array required" }, { status: 400 });
  }

  const destinations = await getDestinations(user.id);
  const defaultDestination = destinations[0];

  let created = 0;
  let failed = 0;
  const pieceIds: string[] = [];

  for (const item of items) {
    if (!item.title?.trim()) { failed++; continue; }

    try {
      // Create draft piece on backend
      const pieceRes = await fetch(`${BACKEND}/api/content/pieces`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Tenant-ID": user.id,
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

      // Schedule in calendar if date is set — destination is optional for planning entries
      if (item.scheduled_date) {
        const scheduledAt = new Date(item.scheduled_date);
        scheduledAt.setHours(9, 0, 0, 0);
        if (scheduledAt.getTime() > Date.now() - 86400_000) {
          await appendScheduled(user.id, {
            piece_id: pieceId || `strategy-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            destination_id: defaultDestination?.id ?? "",
            scheduled_at: scheduledAt.toISOString(),
            payload: {
              title: item.title,
              slug: item.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
              body_markdown: "",
              excerpt: "",
              meta_description: "",
              tags: [],
              language: "sv",
              status: "draft",
            },
          });
        }
      }

      created++;
    } catch {
      failed++;
    }
  }

  return NextResponse.json({ created, failed, piece_ids: pieceIds });
}
