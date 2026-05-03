import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getAdapter } from "@/lib/integrations/cms";
import { markdownToHtml } from "@/lib/integrations/cms/markdown";
import { buildArticleJsonLd } from "@/lib/integrations/jsonld";
import { PublishInput } from "@/lib/integrations/cms/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface ScheduledRow {
  id: string;
  piece_id: string;
  destination_id: string;
  scheduled_at: string;
  status: string;
  published_url?: string;
  error?: string;
  payload?: Record<string, unknown>;
}

interface DestinationRow {
  id: string;
  kind: import("@/lib/integrations/cms/types").CmsKind;
  name: string;
  config: Record<string, string>;
}

interface SettingsRow {
  scheduled_publishes?: ScheduledRow[];
  publishing_destinations?: DestinationRow[];
  brand_name?: string;
  [key: string]: unknown;
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const expected = process.env.CRON_SECRET;
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "supabase service role not configured" }, { status: 500 });
  }

  const admin = createServerClient(url, key, {
    cookies: { getAll: () => [], setAll: () => {} },
  });

  const { data: rows, error } = await admin
    .from("user_settings")
    .select("user_id, settings");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const now = Date.now();
  const summary: { processed: number; published: number; failed: number } = {
    processed: 0,
    published: 0,
    failed: 0,
  };

  for (const row of rows || []) {
    const settings = ((row as { settings?: SettingsRow }).settings || {}) as SettingsRow;
    const scheduled: ScheduledRow[] = settings.scheduled_publishes || [];
    const destinations: DestinationRow[] = settings.publishing_destinations || [];
    if (!scheduled.length) continue;

    let mutated = false;
    for (const item of scheduled) {
      if (item.status !== "scheduled") continue;
      if (Date.parse(item.scheduled_at) > now) continue;

      summary.processed += 1;
      const dest = destinations.find((d) => d.id === item.destination_id);
      if (!dest) {
        item.status = "failed";
        item.error = "destination not found";
        summary.failed += 1;
        mutated = true;
        continue;
      }
      try {
        item.status = "publishing";
        const payload = (item.payload || {}) as Record<string, unknown>;
        const str = (k: string) => (typeof payload[k] === "string" ? (payload[k] as string) : undefined);
        const arr = (k: string) => (Array.isArray(payload[k]) ? (payload[k] as string[]) : undefined);
        const bodyMd = str("body_markdown") || "";
        const jsonld = buildArticleJsonLd({
          title: str("title") || "",
          description: str("excerpt"),
          url: str("canonical_url"),
          image: str("featured_image_url"),
          language: str("language"),
          keywords: arr("tags"),
          author_name: settings.brand_name,
          publisher_name: settings.brand_name,
        });
        const input: PublishInput = {
          title: str("title") || "",
          slug: str("slug"),
          body_markdown: bodyMd,
          body_html: markdownToHtml(bodyMd),
          excerpt: str("excerpt"),
          meta_description: str("meta_description"),
          tags: arr("tags") || [],
          language: str("language"),
          featured_image_url: str("featured_image_url"),
          canonical_url: str("canonical_url"),
          jsonld,
          status: (str("status") === "draft" ? "draft" : "published") as "draft" | "published",
        };
        const adapter = getAdapter(dest.kind);
        const result = await adapter.publish(dest.config, input);
        item.status = "published";
        item.published_url = result.url;
        summary.published += 1;
      } catch (e) {
        item.status = "failed";
        item.error = e instanceof Error ? e.message : "publish failed";
        summary.failed += 1;
      }
      mutated = true;
    }
    if (mutated) {
      const next = { ...settings, scheduled_publishes: scheduled };
      await admin
        .from("user_settings")
        .update({ settings: next, updated_at: new Date().toISOString() })
        .eq("user_id", row.user_id);
    }
  }

  return NextResponse.json({ ok: true, ...summary });
}
