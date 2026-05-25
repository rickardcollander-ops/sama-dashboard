import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getAdapter } from "@/lib/integrations/cms";
import { markdownToHtml } from "@/lib/integrations/cms/markdown";
import { buildArticleJsonLd } from "@/lib/integrations/jsonld";
import { PublishInput } from "@/lib/integrations/cms/types";
import {
  AutopilotConfig,
  ingestDueApprovedPieces,
  markPiecePublished,
} from "@/lib/integrations/auto-publish-bridge";
import { buildGithubVirtualDestination } from "@/lib/integrations/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BACKEND =
  process.env.SAMA_API_URL ||
  process.env.NEXT_PUBLIC_SAMA_API_URL ||
  "https://web-production-5324a.up.railway.app";

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

  // Scheduled publishes are stored in user_sites.settings (written by
  // appendScheduled in lib/integrations/store.ts). The old cron read from
  // user_settings which is the wrong table — nothing was ever processed.
  const { data: rows, error } = await admin
    .from("user_sites")
    .select("id, user_id, settings");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Brand name lives in user_settings, not user_sites. Load it once per user
  // so we can pass it to the JSON-LD builder without a query per item.
  const userIds = [...new Set((rows || []).map((r) => (r as { user_id: string }).user_id))];
  const brandByUserId = new Map<string, string | undefined>();
  const autopilotByUserId = new Map<string, AutopilotConfig | undefined>();
  if (userIds.length) {
    const { data: userSettingsRows } = await admin
      .from("user_settings")
      .select("user_id, settings")
      .in("user_id", userIds);
    for (const ur of userSettingsRows || []) {
      const s = ((ur as { settings?: Record<string, unknown> }).settings || {}) as Record<string, unknown>;
      const uid = (ur as { user_id: string }).user_id;
      brandByUserId.set(uid, typeof s.brand_name === "string" ? (s.brand_name as string) : undefined);
      autopilotByUserId.set(
        uid,
        s.content_autopilot && typeof s.content_autopilot === "object"
          ? (s.content_autopilot as AutopilotConfig)
          : undefined,
      );
    }
  }

  const now = Date.now();
  const summary = {
    processed: 0,
    published: 0,
    failed: 0,
    ingested: 0,
    skipped_no_destination: 0,
    skipped_no_body: 0,
    skipped_low_score: 0,
    backend_sync_failed: 0,
  };

  for (const row of rows || []) {
    const siteId = (row as { id: string }).id;
    const userId = (row as { user_id: string }).user_id;
    const settings = ((row as { settings?: SettingsRow }).settings || {}) as SettingsRow;
    const scheduled: ScheduledRow[] = settings.scheduled_publishes || [];
    const destinations: DestinationRow[] = [...(settings.publishing_destinations || [])];
    // Surface the standalone GitHub connection as a destination so bridge items
    // (and manual ones) targeting `github-default` resolve here — it lives in
    // settings.github, not publishing_destinations.
    const githubVirtual = buildGithubVirtualDestination(settings);
    if (githubVirtual && !destinations.some((d) => d.id === githubVirtual.id)) {
      destinations.push(githubVirtual);
    }

    const brandName = brandByUserId.get(userId);

    let mutated = false;

    // Bridge phase: pull due, approved, auto-publish backend pieces into the
    // queue so they drain in this same tick. Runs before the empty-queue guard
    // so sites with no prior queue still get their approved articles published.
    const bridge = await ingestDueApprovedPieces({
      backendUrl: BACKEND,
      siteId,
      settings,
      autopilot: autopilotByUserId.get(userId),
      brandName,
      now,
    });
    if (bridge.newItems.length) {
      scheduled.push(...bridge.newItems);
      mutated = true;
    }
    summary.ingested += bridge.ingested;
    summary.skipped_no_destination += bridge.skipped_no_destination;
    summary.skipped_no_body += bridge.skipped_no_body;
    summary.skipped_low_score += bridge.skipped_low_score;

    if (!scheduled.length) continue;

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
          author_name: brandName,
          publisher_name: brandName,
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

        // Idempotency: flip the backend piece to published so the next tick's
        // calendar filter no longer matches it. Only bridge-ingested items
        // carry a real backend piece_id worth syncing.
        if (item.payload?.source === "auto_bridge") {
          const sync = await markPiecePublished(BACKEND, siteId, item.piece_id, result.url);
          if (!sync.ok) {
            item.error = `published; backend sync failed: ${sync.error}`;
            summary.backend_sync_failed += 1;
          }
        }
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
        .from("user_sites")
        .update({ settings: next, updated_at: new Date().toISOString() })
        .eq("id", siteId);
    }
  }

  return NextResponse.json({ ok: true, ...summary });
}
