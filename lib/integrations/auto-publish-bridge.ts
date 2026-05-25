import { CmsDestination } from "./cms/types";
import { buildArticleJsonLd } from "./jsonld";
import { excerptFromMarkdown, markdownToHtml, slugify } from "./cms/markdown";
import {
  ScheduledPublish,
  SettingsJson,
  buildGithubVirtualDestination,
} from "./store";

export interface AutopilotConfig {
  enabled?: boolean;
  auto_publish?: boolean;
  min_score_for_publish?: number;
}

export interface BridgeContext {
  backendUrl: string;
  siteId: string;
  settings: SettingsJson;
  autopilot: AutopilotConfig | undefined;
  brandName?: string;
  now: number;
  windowMs?: number;
}

export interface BridgeResult {
  ingested: number;
  skipped_no_destination: number;
  skipped_no_body: number;
  skipped_low_score: number;
  errors: { piece_id: string; error: string }[];
  newItems: ScheduledPublish[];
}

interface CalendarRow {
  content_piece_id?: string | null;
  piece_status?: string | null;
  scheduled_for?: string | null;
  auto_publish_on_schedule?: boolean;
  article_score?: number | null;
  title?: string;
  content_type?: string;
  target_keyword?: string;
}

const DEFAULT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

function emptyResult(): BridgeResult {
  return {
    ingested: 0,
    skipped_no_destination: 0,
    skipped_no_body: 0,
    skipped_low_score: 0,
    errors: [],
    newItems: [],
  };
}

function tenantHeaders(siteId: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-Tenant-ID": siteId,
    "X-Sama-Intent": "user-action",
  };
}

/**
 * A real CMS post is a stronger publish target than a git commit, so a
 * configured CMS destination wins over the GitHub virtual destination when both
 * exist. Mirrors the `defaultDestination = destinations[0]` choice used by the
 * manual publish paths.
 */
export function resolveBridgeDestination(settings: SettingsJson): CmsDestination | null {
  const raw = settings.publishing_destinations;
  const cms = Array.isArray(raw) ? (raw as CmsDestination[]) : [];
  if (cms.length > 0) return cms[0];
  return buildGithubVirtualDestination(settings);
}

/**
 * Pulls backend plan rows that are approved, due, and flagged for auto-publish,
 * fetches their article body, and returns ScheduledPublish items for the caller
 * to append to `settings.scheduled_publishes`. Does not mutate settings or write
 * to Supabase. Gated on the autopilot auto-publish toggle.
 */
export async function ingestDueApprovedPieces(ctx: BridgeContext): Promise<BridgeResult> {
  if (!(ctx.autopilot?.enabled && ctx.autopilot?.auto_publish)) {
    return emptyResult();
  }

  const result = emptyResult();
  const windowMs = ctx.windowMs ?? DEFAULT_WINDOW_MS;
  const start = new Date(ctx.now - windowMs).toISOString();
  // Pad the end so timezone-only `scheduled_for` dates for today are returned;
  // the strict `scheduled_for <= now` filter below still gates what publishes.
  const end = new Date(ctx.now + 24 * 60 * 60 * 1000).toISOString();

  let rows: CalendarRow[];
  try {
    const url = `${ctx.backendUrl}/api/content/plan/calendar?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
    const res = await fetch(url, { headers: tenantHeaders(ctx.siteId) });
    if (!res.ok) return result;
    const data = (await res.json().catch(() => ({}))) as {
      scheduled?: CalendarRow[];
      items?: CalendarRow[];
    };
    rows = data.scheduled || data.items || [];
  } catch {
    return result;
  }

  const minScore =
    typeof ctx.autopilot.min_score_for_publish === "number"
      ? ctx.autopilot.min_score_for_publish
      : undefined;

  const existing: ScheduledPublish[] = Array.isArray(ctx.settings.scheduled_publishes)
    ? (ctx.settings.scheduled_publishes as ScheduledPublish[])
    : [];
  const alreadyQueued = new Set(
    existing.filter((s) => s.status !== "failed").map((s) => s.piece_id),
  );

  const due = rows.filter((r) => {
    if (!r.auto_publish_on_schedule) return false;
    if (!r.content_piece_id) return false;
    if (r.piece_status !== "approved") return false;
    if (!r.scheduled_for) return false;
    const ts = Date.parse(r.scheduled_for);
    if (Number.isNaN(ts) || ts > ctx.now) return false;
    if (alreadyQueued.has(r.content_piece_id)) return false;
    return true;
  });

  if (due.length === 0) return result;

  const dest = resolveBridgeDestination(ctx.settings);
  if (!dest) {
    result.skipped_no_destination = due.length;
    return result;
  }

  for (const row of due) {
    const pieceId = row.content_piece_id as string;

    // Score gate — an unscored piece passes so the scorer can't silently stall
    // the pipeline; a present score below threshold is held back.
    if (minScore !== undefined && typeof row.article_score === "number" && row.article_score < minScore) {
      result.skipped_low_score += 1;
      continue;
    }

    let bodyMd = "";
    let metaTitle = row.title || "";
    let language: string | undefined;
    let featuredImage: string | undefined;
    let tags: string[] = [];
    try {
      const res = await fetch(`${ctx.backendUrl}/api/content/pieces/${encodeURIComponent(pieceId)}`, {
        headers: tenantHeaders(ctx.siteId),
      });
      if (!res.ok) {
        result.errors.push({ piece_id: pieceId, error: `piece fetch ${res.status}` });
        continue;
      }
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      const piece = (data.piece && typeof data.piece === "object" ? data.piece : data) as Record<string, unknown>;
      bodyMd = [piece.body, piece.content, piece.markdown].find((v) => typeof v === "string" && v) as string || "";
      if (typeof piece.title === "string" && piece.title) metaTitle = piece.title;
      if (typeof piece.language === "string") language = piece.language;
      if (typeof piece.featured_image_url === "string") featuredImage = piece.featured_image_url;
      if (Array.isArray(piece.tags)) tags = piece.tags.filter((t): t is string => typeof t === "string");
    } catch (e) {
      result.errors.push({ piece_id: pieceId, error: e instanceof Error ? e.message : "piece fetch failed" });
      continue;
    }

    if (!bodyMd.trim()) {
      result.skipped_no_body += 1;
      continue;
    }

    const lang =
      language ||
      (typeof ctx.settings.content_language === "string" ? (ctx.settings.content_language as string) : undefined) ||
      "en";
    const slug = slugify(metaTitle);
    const excerpt = excerptFromMarkdown(bodyMd);
    const blogUrl = typeof ctx.settings.blog_url === "string" ? (ctx.settings.blog_url as string) : undefined;
    const domain = typeof ctx.settings.domain === "string" ? (ctx.settings.domain as string) : undefined;
    const canonicalBase = blogUrl || (domain ? `https://${domain}` : "");
    const canonicalUrl = canonicalBase ? `${canonicalBase.replace(/\/$/, "")}/${slug}` : undefined;

    const jsonld = buildArticleJsonLd({
      title: metaTitle,
      description: excerpt,
      url: canonicalUrl,
      image: featuredImage,
      language: lang,
      keywords: tags,
      author_name: ctx.brandName,
      publisher_name: ctx.brandName,
    });

    const item: ScheduledPublish = {
      id: `sched_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      piece_id: pieceId,
      destination_id: dest.id,
      scheduled_at: new Date(ctx.now).toISOString(),
      status: "scheduled",
      payload: {
        title: metaTitle,
        slug,
        body_markdown: bodyMd,
        body_html: markdownToHtml(bodyMd),
        excerpt,
        meta_description: excerpt,
        tags,
        language: lang,
        featured_image_url: featuredImage,
        canonical_url: canonicalUrl,
        jsonld,
        status: "published",
        source: "auto_bridge",
      },
    };
    result.newItems.push(item);
    alreadyQueued.add(pieceId);
    result.ingested += 1;
  }

  return result;
}

/**
 * Flips the backend piece to published so the next cron tick no longer matches
 * it (primary idempotency guard). Never throws — a sync failure is reported so
 * the caller can keep the queue item published and reconcile later.
 */
export async function markPiecePublished(
  backendUrl: string,
  siteId: string,
  pieceId: string,
  publishedUrl?: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${backendUrl}/api/content/pieces/${encodeURIComponent(pieceId)}`, {
      method: "PATCH",
      headers: tenantHeaders(siteId),
      body: JSON.stringify({ status: "published", published_url: publishedUrl }),
    });
    if (!res.ok) return { ok: false, error: `patch ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "patch failed" };
  }
}
