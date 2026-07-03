import { CmsDestination } from "./cms/types";
import { buildArticleJsonLd } from "./jsonld";
import { excerptFromMarkdown, markdownToHtml, slugify } from "./cms/markdown";
import {
  SitemapEntry,
  fetchSitemapEntries,
  injectInternalLinks,
  resolveSiteOrigin,
} from "./internal-links";
import {
  ScheduledPublish,
  SettingsJson,
  buildGithubVirtualDestination,
} from "./store";
import { mapPool } from "./concurrency";

export interface AutopilotConfig {
  enabled?: boolean;
  auto_publish?: boolean;
  min_score_for_publish?: number;
}

export interface BridgeContext {
  backendUrl: string;
  siteId: string;
  // Owning account (the site owner's user_id). Sent as X-Sama-Account-Id so the
  // backend's tenant middleware can resolve a tenant on the protected
  // /api/content/* routes without a Supabase JWT — these are service-to-service
  // cron calls. Without it the bare legacy X-Tenant-ID is rejected and every
  // read comes back empty, so nothing ever publishes.
  accountId?: string;
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
  /** True when the calendar read itself failed — distinguishes a backend
   *  outage from a legitimate "nothing due" empty result. */
  calendar_fetch_failed: boolean;
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
    calendar_fetch_failed: false,
    errors: [],
    newItems: [],
  };
}

// Every backend call in the bridge runs inside the 5-min cron's shared time
// budget — an unresponsive backend must fail the call, not hold a mapPool
// slot until the platform kills the whole run.
const FETCH_TIMEOUT_MS = 15_000;

function tenantHeaders(siteId: string, accountId?: string): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    // The backend's tenant middleware treats /api/content/* as protected and
    // rejects a bare legacy X-Tenant-ID (no JWT on these cron calls) unless the
    // tenant is allowlisted — returning an empty {} on GET and 401 on PATCH.
    // Sending the explicit site + account headers is the same contract the
    // authenticated dashboard proxy uses, so the tenant resolves regardless of
    // the LEGACY_TENANT_HEADERS_ALLOW env allowlist.
    "X-Sama-Site-Id": siteId,
    // Kept for backward-compat with backend code still reading the legacy header.
    "X-Tenant-ID": siteId,
    "X-Sama-Intent": "user-action",
  };
  if (accountId) headers["X-Sama-Account-Id"] = accountId;
  // Service secret: marks these cron calls as trusted server-to-server so the
  // backend's tenant middleware honours the headers without a Supabase JWT.
  if (process.env.SAMA_INTERNAL_TOKEN) {
    headers["X-Sama-Internal-Token"] = process.env.SAMA_INTERNAL_TOKEN;
  }
  return headers;
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
  // Gate on autopilot being enabled only — NOT on the auto_publish toggle. A
  // piece reaches the calendar with piece_status='approved' either because the
  // backend auto-approved it (fully-automatic mode) or because a human approved
  // it in /c/approvals (review-first mode). Both mean "ready to publish", so the
  // bridge — the single publisher for both modes — ships any approved, due piece.
  if (!ctx.autopilot?.enabled) {
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
    const res = await fetch(url, {
      headers: tenantHeaders(ctx.siteId, ctx.accountId),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      result.calendar_fetch_failed = true;
      return result;
    }
    const data = (await res.json().catch(() => ({}))) as {
      scheduled?: CalendarRow[];
      items?: CalendarRow[];
    };
    rows = data.scheduled || data.items || [];
  } catch {
    result.calendar_fetch_failed = true;
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

  // Resolve sitemap entries once for the whole batch (cached per origin) so we
  // can weave internal links into each article body before it ships.
  const blogUrlSetting = typeof ctx.settings.blog_url === "string" ? (ctx.settings.blog_url as string) : undefined;
  const domainSetting = typeof ctx.settings.domain === "string" ? (ctx.settings.domain as string) : undefined;
  const linkOrigin = resolveSiteOrigin(blogUrlSetting, domainSetting);
  let sitemapEntries: SitemapEntry[] = [];
  if (linkOrigin) {
    try {
      sitemapEntries = await fetchSitemapEntries(linkOrigin);
    } catch {
      sitemapEntries = [];
    }
  }

  // Score gate — applies ONLY to backend auto-approved rows (flagged
  // auto_publish_on_schedule). A human approval in /c/approvals is an
  // explicit "publish this" and must never be silently held back by the
  // score threshold; the old unconditional gate stranded low-scoring
  // human-approved pieces as skipped_low_score forever.
  const toFetch = due.filter((row) => {
    if (
      row.auto_publish_on_schedule === true &&
      minScore !== undefined &&
      typeof row.article_score === "number" &&
      row.article_score < minScore
    ) {
      result.skipped_low_score += 1;
      return false;
    }
    return true;
  });

  // Fetch the article bodies with bounded concurrency rather than one
  // sequential round-trip per due piece (the previous N+1). Each task returns
  // the ScheduledPublish to queue, or null when the piece is skipped/errors;
  // mapPool preserves input order so the queue is deterministic.
  const PIECE_CONCURRENCY = 5;
  const built = await mapPool(toFetch, PIECE_CONCURRENCY, async (row): Promise<ScheduledPublish | null> => {
    const pieceId = row.content_piece_id as string;

    let bodyMd = "";
    let metaTitle = row.title || "";
    let language: string | undefined;
    let featuredImage: string | undefined;
    let tags: string[] = [];
    try {
      const res = await fetch(`${ctx.backendUrl}/api/content/pieces/${encodeURIComponent(pieceId)}`, {
        headers: tenantHeaders(ctx.siteId, ctx.accountId),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) {
        result.errors.push({ piece_id: pieceId, error: `piece fetch ${res.status}` });
        return null;
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
      return null;
    }

    if (!bodyMd.trim()) {
      result.skipped_no_body += 1;
      return null;
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

    const finalMd =
      sitemapEntries.length > 0
        ? injectInternalLinks(bodyMd, sitemapEntries, { selfHref: canonicalUrl ?? `/${slug}` }).markdown
        : bodyMd;

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

    return {
      id: `sched_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      piece_id: pieceId,
      destination_id: dest.id,
      scheduled_at: new Date(ctx.now).toISOString(),
      status: "scheduled",
      payload: {
        title: metaTitle,
        slug,
        body_markdown: finalMd,
        body_html: markdownToHtml(finalMd),
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
  });

  for (const item of built) {
    if (item) {
      result.newItems.push(item);
      result.ingested += 1;
    }
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
  accountId?: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${backendUrl}/api/content/pieces/${encodeURIComponent(pieceId)}`, {
      method: "PATCH",
      headers: tenantHeaders(siteId, accountId),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      // Use the columns the backend piece actually stores the live URL in
      // (external_url / target_url). The backend stamps published_at itself when
      // status flips to "published". The old `published_url` key was silently
      // dropped, so the URL — and the published_at the 24h social email depends
      // on — never landed.
      body: JSON.stringify({
        status: "published",
        external_url: publishedUrl,
        target_url: publishedUrl,
      }),
    });
    if (!res.ok) return { ok: false, error: `patch ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "patch failed" };
  }
}
