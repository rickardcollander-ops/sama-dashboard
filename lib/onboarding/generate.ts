/**
 * Orchestrates the post-onboarding "build the user's starter content"
 * pipeline. Runs the following sequential steps:
 *
 *   1. Site meta scrape       → brand_name/description/language fallback
 *   2. AI brand profile       → business_type, USPs, tone, country, extra competitors
 *   3. Relevant keywords      → 12 ranked SEO keywords for the brand
 *   4. 30-day plan            → one content idea per day, mapped to a keyword
 *   5. Two full drafts        → 1500-2500 word articles for the top 2 keywords
 *   6. Backend sync           → push pieces to SAMA so they show in the calendar
 *   7. Kick off audits        → fire-and-forget site-audit + AI visibility
 *
 * The result is persisted onto user_sites.settings.onboarding_result so
 * downstream pages (content/plan calendar, content list) can read it
 * without depending on onboarding_jobs.
 *
 * Designed to be called from after()/waitUntil() in an API route so the
 * HTTP response is sent immediately and the job runs in the background.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

const MODEL_PLANNER = "claude-sonnet-4-6";
const MODEL_WRITER = "claude-sonnet-4-6";
const MODEL_PROFILER = "claude-haiku-4-5-20251001";

// The SAMA agent backend (Railway) hosts content_pieces and the AI/audit
// runners. Default matches the proxy fallback in /api/sama/[...path].
const SAMA_BACKEND_URL =
  process.env.SAMA_API_URL ||
  process.env.NEXT_PUBLIC_SAMA_API_URL ||
  "https://web-production-5324a.up.railway.app";

export interface OnboardingFormInput {
  domain: string;
  brand_name: string;
  brand_description: string;
  target_audience: string;
  content_language: string;
  competitors: string[];
  geo_queries: string[];
  brand_color?: string;
  example_article_url?: string;
}

// Mirrors the enum values the existing settings page uses so the AI-filled
// values render correctly in the dropdowns there.
type BusinessType = "" | "ecommerce" | "local" | "services" | "software" | "media" | "other";
type ToneOfVoice = "professional" | "friendly" | "authoritative" | "playful" | "neutral";

export interface BrandProfile {
  business_type: BusinessType;
  unique_selling_points: string;
  tone_of_voice: ToneOfVoice;
  country: string; // ISO 2-letter, e.g. "SE", "US"
  extra_competitors: string[];
}

export interface GeneratedKeyword {
  text: string;
  intent: "informational" | "commercial" | "transactional" | "navigational";
  priority: "high" | "medium" | "low";
  reason: string;
}

export interface PlanEntry {
  day: number;
  scheduled_for: string;
  title: string;
  target_keyword: string;
  content_type: "blog_post" | "linkedin" | "epost";
  angle: string;
}

export interface DraftArticle {
  title: string;
  slug: string;
  meta_title: string;
  meta_description: string;
  target_keyword: string;
  word_count: number;
  body_markdown: string;
}

export interface OnboardingResult {
  site_meta: {
    domain: string;
    brand_name: string;
    brand_description: string;
    content_language: string;
  };
  brand_profile?: BrandProfile;
  keywords: GeneratedKeyword[];
  plan: PlanEntry[];
  drafts: DraftArticle[];
  generated_at: string;
  // Best-effort sync status. The dashboard reads content_pieces from the
  // external SAMA backend (Railway), so we push the generated pieces
  // there at the end of the job. If the backend is unreachable the rest
  // of the result is still persisted and the review page renders fine.
  backend_sync?: {
    attempted: boolean;
    pieces_created: number;
    pieces_failed: number;
    error?: string;
  };
  // Site audit + AI visibility analysis are fire-and-forget — we don't
  // wait for them. These IDs (when present) let the dashboard deep-link
  // to the running analyses on the Insikter page.
  audits_started?: {
    site_audit_id?: string;
    analysis_run_id?: string;
    error?: string;
  };
  // The SAMA backend insists on /api/tenant/activate before any
  // content_pieces / plan rows are accepted. If activation fails, all
  // downstream writes will fail too — surfacing it explicitly tells the
  // user (and us) exactly which step broke the chain.
  tenant_activation?: {
    succeeded: boolean;
    error?: string;
  };
}

type JobStep =
  | "queued"
  | "analyzing_site"
  | "analyzing_brand"
  | "finding_keywords"
  | "planning_content"
  | "writing_article_1"
  | "writing_article_2"
  | "syncing_calendar"
  | "starting_audits"
  | "saving"
  | "done";

const STEP_PROGRESS: Record<JobStep, number> = {
  queued: 0,
  analyzing_site: 8,
  analyzing_brand: 18,
  finding_keywords: 28,
  planning_content: 42,
  writing_article_1: 58,
  writing_article_2: 78,
  syncing_calendar: 88,
  starting_audits: 94,
  saving: 97,
  done: 100,
};

interface JobUpdater {
  setStep(step: JobStep): Promise<void>;
  fail(message: string): Promise<void>;
  finish(result: OnboardingResult): Promise<void>;
}

export function makeJobUpdater(
  admin: SupabaseClient,
  jobId: string,
): JobUpdater {
  return {
    async setStep(step) {
      await admin
        .from("onboarding_jobs")
        .update({
          status: step === "done" ? "done" : "running",
          step,
          progress: STEP_PROGRESS[step],
        })
        .eq("id", jobId);
    },
    async fail(message) {
      await admin
        .from("onboarding_jobs")
        .update({ status: "error", error: message.slice(0, 1000) })
        .eq("id", jobId);
    },
    async finish(result) {
      await admin
        .from("onboarding_jobs")
        .update({
          status: "done",
          step: "done",
          progress: 100,
          result,
        })
        .eq("id", jobId);
    },
  };
}

async function callClaudeTool<T>(opts: {
  apiKey: string;
  model: string;
  system: string;
  user: string;
  toolName: string;
  toolSchema: Record<string, unknown>;
  maxTokens?: number;
}): Promise<T> {
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": opts.apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: opts.maxTokens ?? 4000,
      system: opts.system,
      messages: [{ role: "user", content: opts.user }],
      tools: [
        {
          name: opts.toolName,
          description: `Submit the structured ${opts.toolName} result. Always call this exactly once.`,
          input_schema: opts.toolSchema,
        },
      ],
      tool_choice: { type: "tool", name: opts.toolName },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Anthropic ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const blocks = Array.isArray(data.content) ? data.content : [];
  const toolUse = blocks.find(
    (b: { type?: string; name?: string }) =>
      b?.type === "tool_use" && b?.name === opts.toolName,
  ) as { input?: T } | undefined;
  if (!toolUse?.input) {
    throw new Error(`Anthropic did not return a ${opts.toolName} tool call`);
  }
  return toolUse.input;
}

async function callClaudeText(opts: {
  apiKey: string;
  model: string;
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<string> {
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": opts.apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: opts.maxTokens ?? 8000,
      system: opts.system,
      messages: [{ role: "user", content: opts.user }],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Anthropic ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const blocks = Array.isArray(data.content) ? data.content : [];
  const textBlock = blocks.find(
    (b: { type?: string; text?: string }) =>
      b?.type === "text" && typeof b?.text === "string",
  ) as { text?: string } | undefined;
  return (textBlock?.text || "").trim();
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

function todayPlus(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function countWords(s: string): number {
  return s.split(/\s+/).filter((t) => t.length > 0).length;
}

const KEYWORDS_TOOL_SCHEMA = {
  type: "object" as const,
  properties: {
    keywords: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          intent: {
            type: "string",
            enum: ["informational", "commercial", "transactional", "navigational"],
          },
          priority: { type: "string", enum: ["high", "medium", "low"] },
          reason: { type: "string" },
        },
        required: ["text", "intent", "priority", "reason"],
      },
    },
  },
  required: ["keywords"],
};

const PLAN_TOOL_SCHEMA = {
  type: "object" as const,
  properties: {
    plan: {
      type: "array",
      items: {
        type: "object",
        properties: {
          day: { type: "integer" },
          title: { type: "string" },
          target_keyword: { type: "string" },
          content_type: {
            type: "string",
            enum: ["blog_post", "linkedin", "epost"],
          },
          angle: { type: "string" },
        },
        required: ["day", "title", "target_keyword", "content_type", "angle"],
      },
    },
  },
  required: ["plan"],
};

async function generateKeywords(
  apiKey: string,
  input: OnboardingFormInput,
): Promise<GeneratedKeyword[]> {
  const system = `You are a senior SEO strategist. Given a brand's description and audience, you propose the 12 most commercially valuable search keywords the brand should rank for in Google. Bias toward:
- realistic head and long-tail terms a real prospect would type
- terms with clear buyer intent (problem, comparison, "best X for Y")
- terms where this brand has a believable chance of ranking based on its description and audience
- NEVER include the brand's own name or domain — those are not opportunities, they're navigational
Always reply by calling submit_keywords.`;

  const user = `Brand: ${input.brand_name || "(unknown)"}
Domain: ${input.domain}
Description: ${input.brand_description || "(none)"}
Target audience: ${input.target_audience || "(general)"}
Output language: ${input.content_language || "en"}
Competitors: ${input.competitors.join(", ") || "(none)"}

Produce exactly 12 keywords as a JSON tool call. Prioritise so the top entries are the highest-value ones for this brand.`;

  const out = await callClaudeTool<{ keywords: GeneratedKeyword[] }>({
    apiKey,
    model: MODEL_PLANNER,
    system,
    user,
    toolName: "submit_keywords",
    toolSchema: KEYWORDS_TOOL_SCHEMA,
    maxTokens: 2000,
  });
  return (out.keywords || []).slice(0, 12);
}

async function generatePlan(
  apiKey: string,
  input: OnboardingFormInput,
  keywords: GeneratedKeyword[],
): Promise<PlanEntry[]> {
  const system = `You are a content strategist. Given a brand and a ranked list of target keywords, produce a 30-day content calendar with one piece per day. Each piece must:
- target one specific keyword from the provided list (no inventing new ones)
- vary content_type sensibly: roughly 60% blog_post, 25% linkedin, 15% epost
- have a concrete, click-worthy title in the brand's output language
- include a one-sentence "angle" explaining the take or hook
- cover all 12 keywords across the month, weighted toward the higher-priority ones
Always reply by calling submit_plan.`;

  const user = `Brand: ${input.brand_name}
Description: ${input.brand_description}
Target audience: ${input.target_audience}
Output language: ${input.content_language}

Available keywords (priority high→low):
${keywords.map((k, i) => `${i + 1}. ${k.text} [${k.priority}/${k.intent}]`).join("\n")}

Produce a 30-day plan with day = 1..30 (day 1 = today + 0 days, day 2 = +1 day, etc.).`;

  const out = await callClaudeTool<{ plan: PlanEntry[] }>({
    apiKey,
    model: MODEL_PLANNER,
    system,
    user,
    toolName: "submit_plan",
    toolSchema: PLAN_TOOL_SCHEMA,
    maxTokens: 6000,
  });
  const allowed = new Set(keywords.map((k) => k.text.toLowerCase()));
  return (out.plan || [])
    .filter((p) => allowed.has((p.target_keyword || "").toLowerCase()))
    .slice(0, 30)
    .map((p) => ({
      ...p,
      scheduled_for: todayPlus(Math.max(0, (p.day ?? 1) - 1)),
    }));
}

async function generateDraft(
  apiKey: string,
  input: OnboardingFormInput,
  keyword: GeneratedKeyword,
  planEntry: PlanEntry | undefined,
): Promise<DraftArticle> {
  const targetTitle = planEntry?.title || `${keyword.text}: a complete guide`;
  const angle = planEntry?.angle || "";

  const system = `You are a senior content writer. Write a single high-quality SEO blog post in the target output language. Requirements:
- 1500–2500 words
- Markdown only (no HTML), use ## for H2 and ### for H3
- Start with a 2-3 sentence engaging intro that hooks the reader (no H1 — the title is rendered separately)
- 4–7 H2 sections, each with substantive paragraphs (not lists of fluff)
- Naturally weave the target keyword into the intro, at least 2 H2 headings, and the conclusion — never stuff
- Include a short "Key takeaways" section near the end
- End with a one-paragraph conclusion that ties back to the brand's value
- Reference the brand by name once or twice where it's natural, never salesy
- Do NOT invent statistics; if you cite numbers, frame them as illustrative ("studies suggest", "many teams report")
- Output ONLY the markdown body. No preamble, no closing remarks outside the article.`;

  const user = `Brand: ${input.brand_name}
Description: ${input.brand_description}
Target audience: ${input.target_audience}
Output language: ${input.content_language}
Tone: helpful, expert, plain-spoken

Target title: "${targetTitle}"
Target keyword: ${keyword.text}
Angle: ${angle || "(use your judgement)"}

Write the full article now.`;

  const body = await callClaudeText({
    apiKey,
    model: MODEL_WRITER,
    system,
    user,
    maxTokens: 8000,
  });

  // Pull a meta description from the first paragraph if Claude didn't
  // give us one — keeps a single API call instead of a follow-up.
  const firstPara = body.split(/\n{2,}/).find((p) => p.trim().length > 60) || "";
  const metaDescription = firstPara.replace(/\s+/g, " ").trim().slice(0, 160);
  const metaTitle = targetTitle.length <= 60 ? targetTitle : targetTitle.slice(0, 57) + "…";

  return {
    title: targetTitle,
    slug: slugify(targetTitle),
    meta_title: metaTitle,
    meta_description: metaDescription,
    target_keyword: keyword.text,
    word_count: countWords(body),
    body_markdown: body,
  };
}

interface SiteMetaScrape {
  brand_name: string;
  brand_description: string;
  content_language: string;
  // Plain-text excerpt of the rendered page body, used by the brand
  // profiler. Empty string when scraping failed.
  body_text: string;
}

async function scrapeSiteMeta(domain: string): Promise<SiteMetaScrape | null> {
  const host = domain.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").toLowerCase();
  if (!host) return null;
  try {
    const res = await fetch(`https://${host}`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SAMABot/1.0; +https://sama.ai)" },
      signal: AbortSignal.timeout(8_000),
      redirect: "follow",
    });
    if (!res.ok) return null;
    const html = await res.text();
    const og = (prop: string) =>
      html.match(new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']{1,500})["']`, "i"))?.[1]?.trim() || "";
    const meta = (name: string) =>
      html.match(new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']{1,500})["']`, "i"))?.[1]?.trim() || "";
    const title = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i)?.[1]?.trim() || "";
    const lang = html.match(/<html[^>]+lang=["']([a-z]{2,5})/i)?.[1]?.toLowerCase().slice(0, 2) || "";
    const bodyText = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 3000);
    return {
      brand_name: (og("og:site_name") || title.split(/[|–\-—]/)[0]).trim().slice(0, 80),
      brand_description: (og("og:description") || meta("description")).slice(0, 500),
      content_language: lang || "",
      body_text: bodyText,
    };
  } catch {
    return null;
  }
}

const BUSINESS_TYPES: BusinessType[] = ["ecommerce", "local", "services", "software", "media", "other"];
const TONE_VOICES: ToneOfVoice[] = ["professional", "friendly", "authoritative", "playful", "neutral"];

const BRAND_PROFILE_TOOL_SCHEMA = {
  type: "object" as const,
  properties: {
    business_type: { type: "string", enum: BUSINESS_TYPES },
    unique_selling_points: { type: "string" },
    tone_of_voice: { type: "string", enum: TONE_VOICES },
    country: { type: "string" },
    extra_competitors: { type: "array", items: { type: "string" } },
  },
  required: ["business_type", "unique_selling_points", "tone_of_voice", "country"],
};

async function generateBrandProfile(
  apiKey: string,
  input: OnboardingFormInput,
  bodyText: string,
): Promise<BrandProfile> {
  const system = `You profile a brand based on its website and the description the user provided. Always reply by calling submit_brand_profile.

Field rules:
- business_type — pick the single best fit from the enum. "local" = brick-and-mortar / local service; "services" = professional services / agency / consulting; "software" = SaaS/software; "media" = publisher/media; "ecommerce" = online store; "other" if none fit.
- unique_selling_points — 1–2 sentences in the brand's content language describing what makes them unique. Be specific, not generic.
- tone_of_voice — pick the single best fit from the enum.
- country — ISO 3166-1 alpha-2 code (e.g. "SE", "US", "DE"). Infer from TLD, language, addresses or content. Default "SE" only if Swedish content, otherwise pick the most plausible code.
- extra_competitors — 0–4 domain-style competitor suggestions (e.g. "competitor.com"). Do NOT include any competitor the user already listed. Skip the array entirely if you're not confident.`;

  const user = `Brand: ${input.brand_name}
Domain: ${input.domain}
Output language: ${input.content_language}
Description provided by user: ${input.brand_description || "(none)"}
Target audience: ${input.target_audience || "(none)"}
Competitors already listed: ${input.competitors.join(", ") || "(none)"}

Page content excerpt:
${bodyText.slice(0, 2500) || "(scrape failed — base inference on description and domain)"}

Submit the brand profile now.`;

  const out = await callClaudeTool<BrandProfile>({
    apiKey,
    model: MODEL_PROFILER,
    system,
    user,
    toolName: "submit_brand_profile",
    toolSchema: BRAND_PROFILE_TOOL_SCHEMA,
    maxTokens: 800,
  });

  // Normalise — Claude generally honours the enum but guard anyway.
  const business_type: BusinessType = BUSINESS_TYPES.includes(out.business_type)
    ? out.business_type
    : "other";
  const tone_of_voice: ToneOfVoice = TONE_VOICES.includes(out.tone_of_voice)
    ? out.tone_of_voice
    : "professional";
  const country = (out.country || "").trim().toUpperCase().slice(0, 2) || "SE";
  const userCompetitors = new Set(input.competitors.map((c) => c.toLowerCase()));
  const extra_competitors = (Array.isArray(out.extra_competitors) ? out.extra_competitors : [])
    .filter((c): c is string => typeof c === "string" && c.trim().length > 0)
    .map((c) => c.trim().toLowerCase())
    .filter((c) => !userCompetitors.has(c))
    .slice(0, 4);

  return {
    business_type,
    unique_selling_points: (out.unique_selling_points || "").trim().slice(0, 500),
    tone_of_voice,
    country,
    extra_competitors,
  };
}

/**
 * Calls the SAMA backend's tenant activation endpoint. The backend
 * insists on this before any /api/content/* writes are accepted — it
 * creates the tenant row, sets up agent registrations and seeds the
 * scoreboard. The original 7-step onboarding called it from the client
 * after the user finished; we need to do the same from this background
 * job before pushing any content.
 *
 * Returns a string error message on failure, undefined on success.
 */
// Headers required for every backend call: tenant context + the user's
// Supabase bearer (the backend recently migrated to requiring it on top
// of X-Tenant-ID). X-Sama-Account-Id is also required by content
// endpoints; for first-run users their account_id equals user.id —
// matches the fallback in /api/account/list.
function backendHeaders(
  siteId: string,
  accessToken: string,
  accountId: string,
): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "X-Tenant-ID": siteId,
    "X-Sama-Site-Id": siteId,
    "X-Sama-Account-Id": accountId,
    "X-Sama-Intent": "user-action",
    Authorization: `Bearer ${accessToken}`,
  };
}

async function activateTenant(
  siteId: string,
  accessToken: string,
  accountId: string,
): Promise<string | undefined> {
  try {
    const res = await fetch(`${SAMA_BACKEND_URL}/api/tenant/activate`, {
      method: "POST",
      headers: backendHeaders(siteId, accessToken, accountId),
      // Body is intentionally empty — the backend reads tenant context
      // from headers and pulls everything else from user_sites settings.
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return `tenant/activate: HTTP ${res.status} ${body.slice(0, 200)}`;
    }
    return undefined;
  } catch (e) {
    return `tenant/activate: ${e instanceof Error ? e.message : "fetch failed"}`;
  }
}

/**
 * Pushes the 30 plan items + 2 full drafts to the SAMA backend so they
 * show up on the calendar (/c/content/plan) and content list
 * (/c/content). Two upstream endpoints are involved:
 *
 *   - POST /api/content/plan/calendar  → creates a plan item scheduled
 *     for a specific date (this is what /c/content/plan reads).
 *   - POST /api/content/pieces         → creates a full content_piece
 *     with markdown body (this is what /c/content reads).
 *
 * Every entry goes through /plan/calendar so the calendar is fully
 * populated. The two pre-drafted articles ALSO go through /pieces so
 * the user can open the markdown body right away from the content list.
 */
async function syncToBackend(
  siteId: string,
  accessToken: string,
  accountId: string,
  input: OnboardingFormInput,
  plan: PlanEntry[],
  drafts: DraftArticle[],
): Promise<NonNullable<OnboardingResult["backend_sync"]>> {
  let created = 0;
  let failed = 0;
  let firstError: string | undefined;

  // Map the planner's content_type enum onto whatever the backend
  // accepts. /api/content/plan/calendar in the existing UI uses
  // "blog_article" rather than "blog_post" — match that to avoid
  // schema rejection.
  const calendarContentType = (t: PlanEntry["content_type"]): string => {
    switch (t) {
      case "blog_post": return "blog_article";
      case "linkedin": return "linkedin";
      case "epost": return "email";
      default: return "blog_article";
    }
  };

  const recordError = async (res: Response, label: string) => {
    if (firstError) return;
    const body = await res.text().catch(() => "");
    firstError = `${label}: HTTP ${res.status} ${body.slice(0, 200)}`;
  };

  const headers = backendHeaders(siteId, accessToken, accountId);

  // 1. Create all 30 plan/calendar entries. The backend returns
  // {success, error?} on this route — a 200 with success:false still
  // means the row didn't land, so we have to look past res.ok.
  for (const p of plan) {
    try {
      const res = await fetch(`${SAMA_BACKEND_URL}/api/content/plan/calendar`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          title: p.title,
          topic: p.angle || p.title,
          target_keyword: p.target_keyword,
          content_type: calendarContentType(p.content_type),
          priority: "medium",
          scheduled_for: new Date(`${p.scheduled_for}T09:00:00.000Z`).toISOString(),
          auto_publish_on_schedule: false,
          draft_now: false,
          source: "onboarding",
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        failed++;
        await recordError(res, "plan/calendar");
        continue;
      }
      const data = (await res.json().catch(() => null)) as { success?: boolean; error?: string } | null;
      if (data && data.success === false) {
        failed++;
        if (!firstError) {
          firstError = `plan/calendar: ${data.error || "success:false"}`;
        }
        continue;
      }
      created++;
    } catch (e) {
      failed++;
      if (!firstError) firstError = `plan/calendar: ${e instanceof Error ? e.message : "fetch failed"}`;
    }
  }

  // 2. Create the 2 pre-drafted pieces so the content list shows them.
  for (const d of drafts) {
    const planEntry = plan.find((p) => p.target_keyword.toLowerCase() === d.target_keyword.toLowerCase());
    try {
      const res = await fetch(`${SAMA_BACKEND_URL}/api/content/pieces`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          title: d.title,
          slug: d.slug,
          content: d.body_markdown,
          body_markdown: d.body_markdown,
          meta_title: d.meta_title,
          meta_description: d.meta_description,
          target_keyword: d.target_keyword,
          word_count: d.word_count,
          content_type: calendarContentType(planEntry?.content_type || "blog_post"),
          type: calendarContentType(planEntry?.content_type || "blog_post"),
          status: "draft",
          language: input.content_language,
          source: "onboarding",
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        failed++;
        await recordError(res, "pieces");
        continue;
      }
      const data = (await res.json().catch(() => null)) as { success?: boolean; error?: string } | null;
      if (data && data.success === false) {
        failed++;
        if (!firstError) firstError = `pieces: ${data.error || "success:false"}`;
        continue;
      }
      created++;
    } catch (e) {
      failed++;
      if (!firstError) firstError = `pieces: ${e instanceof Error ? e.message : "fetch failed"}`;
    }
  }

  return {
    attempted: true,
    pieces_created: created,
    pieces_failed: failed,
    error: firstError,
  };
}

/**
 * Fire-and-forget POSTs to the SAMA backend's site-audit and AI
 * visibility runners. Both endpoints insert a "running" row and do the
 * heavy lifting in their own background — we only need them to start.
 */
async function kickOffAudits(
  siteId: string,
  accessToken: string,
  accountId: string,
  input: OnboardingFormInput,
): Promise<NonNullable<OnboardingResult["audits_started"]>> {
  const out: NonNullable<OnboardingResult["audits_started"]> = {};

  try {
    const res = await fetch(`${SAMA_BACKEND_URL}/api/site-audit/run`, {
      method: "POST",
      headers: backendHeaders(siteId, accessToken, accountId),
      body: JSON.stringify({ domain: input.domain }),
      signal: AbortSignal.timeout(15_000),
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data?.id) out.site_audit_id = String(data.id);
      else out.error = `site-audit: response had no id (${JSON.stringify(data).slice(0, 150)})`;
    } else {
      const body = await res.text().catch(() => "");
      out.error = `site-audit: HTTP ${res.status} ${body.slice(0, 200)}`;
    }
  } catch (e) {
    out.error = e instanceof Error ? `site-audit: ${e.message}` : "site-audit kickoff failed";
  }

  if (input.geo_queries.length > 0) {
    try {
      const res = await fetch(`${SAMA_BACKEND_URL}/api/analysis/run`, {
        method: "POST",
        headers: backendHeaders(siteId, accessToken, accountId),
        body: JSON.stringify({
          queries: input.geo_queries,
          platforms: ["chatgpt", "claude", "perplexity", "google_aio"],
          brand_name: input.brand_name,
          domain: input.domain,
          competitors: input.competitors,
        }),
        signal: AbortSignal.timeout(30_000),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data?.id) out.analysis_run_id = String(data.id);
        else {
          out.error = `${out.error ? out.error + "; " : ""}analysis: response had no id (${JSON.stringify(data).slice(0, 150)})`;
        }
      } else {
        const body = await res.text().catch(() => "");
        out.error = `${out.error ? out.error + "; " : ""}analysis: HTTP ${res.status} ${body.slice(0, 200)}`;
      }
    } catch (e) {
      out.error = `${out.error ? out.error + "; " : ""}analysis: ${
        e instanceof Error ? e.message : "kickoff failed"
      }`;
    }
  }

  return out;
}

/**
 * Persists the final result on user_sites.settings under "onboarding_result"
 * (and bumps onboarding_completed_at). Service-role client so this works
 * from a background task without a user session cookie.
 */
/**
 * Writes the user's form input to user_sites.settings BEFORE the SAMA
 * backend gets pinged. The backend reads brand context (geo_queries,
 * domain, brand_name, competitors) from the same row to decide whether
 * an analysis can run — without this, the AI visibility runner returns
 * "No queries configured" even when we pass them in the request body.
 *
 * Settings already on the row are preserved (we only fill in fields
 * the user just typed and protect any prior manual edits).
 */
async function persistFormInputEarly(
  admin: SupabaseClient,
  userId: string,
  siteId: string,
  formInput: OnboardingFormInput,
): Promise<void> {
  const { data: row } = await admin
    .from("user_sites")
    .select("settings")
    .eq("id", siteId)
    .maybeSingle();
  const settings = ((row?.settings as Record<string, unknown>) || {}) as Record<string, unknown>;

  const next = {
    ...settings,
    domain: formInput.domain,
    brand_name: formInput.brand_name || (settings.brand_name as string) || "",
    brand_description: formInput.brand_description || (settings.brand_description as string) || "",
    target_audience: formInput.target_audience || (settings.target_audience as string) || "",
    content_language: formInput.content_language || (settings.content_language as string) || "en",
    competitors: formInput.competitors.length > 0
      ? formInput.competitors
      : (Array.isArray(settings.competitors) ? settings.competitors : []),
    geo_queries: formInput.geo_queries.length > 0
      ? formInput.geo_queries
      : (Array.isArray(settings.geo_queries) ? settings.geo_queries : []),
    geo_platforms: Array.isArray(settings.geo_platforms) && settings.geo_platforms.length > 0
      ? settings.geo_platforms
      : ["ChatGPT", "Perplexity", "Claude", "Google AIO"],
    brand_color: formInput.brand_color || (settings.brand_color as string) || "",
    example_article_url:
      formInput.example_article_url || (settings.example_article_url as string) || "",
  };

  const siteName =
    (settings.site_name as string) ||
    formInput.brand_name?.trim() ||
    formInput.domain ||
    "";

  await admin
    .from("user_sites")
    .upsert(
      {
        id: siteId,
        user_id: userId,
        site_name: siteName,
        settings: next,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
}

async function saveResultToSite(
  admin: SupabaseClient,
  userId: string,
  siteId: string,
  formInput: OnboardingFormInput,
  result: OnboardingResult,
): Promise<void> {
  const { data: row } = await admin
    .from("user_sites")
    .select("settings")
    .eq("id", siteId)
    .maybeSingle();
  const settings = ((row?.settings as Record<string, unknown>) || {}) as Record<string, unknown>;

  // Merge AI-inferred brand profile fields into settings only when they
  // weren't already filled in — never overwrite an explicit user choice
  // captured during onboarding or previously edited in Settings.
  const profile = result.brand_profile;
  const mergedCompetitors = (() => {
    if (formInput.competitors.length === 0 && profile && profile.extra_competitors.length > 0) {
      return profile.extra_competitors;
    }
    const existing = new Set(formInput.competitors.map((c) => c.toLowerCase()));
    const extras = (profile?.extra_competitors || []).filter((c) => !existing.has(c.toLowerCase()));
    return [...formInput.competitors, ...extras];
  })();

  const next = {
    ...settings,
    domain: formInput.domain,
    brand_name: formInput.brand_name,
    brand_description: formInput.brand_description,
    target_audience: formInput.target_audience,
    content_language: formInput.content_language,
    competitors: mergedCompetitors,
    geo_queries: formInput.geo_queries.length > 0
      ? formInput.geo_queries
      : (Array.isArray(settings.geo_queries) ? settings.geo_queries : []),
    geo_platforms: Array.isArray(settings.geo_platforms) && settings.geo_platforms.length > 0
      ? settings.geo_platforms
      : ["ChatGPT", "Perplexity", "Claude", "Google AIO"],
    brand_color: formInput.brand_color || (settings.brand_color as string) || "",
    example_article_url:
      formInput.example_article_url || (settings.example_article_url as string) || "",
    business_type:
      (settings.business_type as string) || profile?.business_type || "",
    unique_selling_points:
      (settings.unique_selling_points as string) ||
      profile?.unique_selling_points ||
      "",
    tone_of_voice:
      (settings.tone_of_voice as string) || profile?.tone_of_voice || "professional",
    country: (settings.country as string) || profile?.country || "",
    onboarding_completed_at: new Date().toISOString(),
    onboarding_result: result,
  };

  // Upsert covers two cases: (a) the user already has a site row — we
  // refresh settings on it; (b) brand-new user with no row yet — we
  // create the primary site with id = user.id, matching the legacy
  // convention documented in supabase-user-sites.sql ("The first site
  // always uses id = user.id to preserve existing backend tenant data").
  const siteName =
    formInput.brand_name?.trim() ||
    formInput.domain ||
    (settings.site_name as string) ||
    "";

  const { error } = await admin
    .from("user_sites")
    .upsert(
      {
        id: siteId,
        user_id: userId,
        site_name: siteName,
        settings: next,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
  if (error) {
    throw new Error(`user_sites upsert failed: ${error.message}`);
  }
}

export async function runOnboardingGeneration(opts: {
  admin: SupabaseClient;
  jobId: string;
  userId: string;
  siteId: string;
  input: OnboardingFormInput;
  apiKey: string;
  // Supabase JWT used to authenticate SAMA backend calls. Required —
  // tenant_activate / content_pieces / plan_calendar all 401 without it.
  userAccessToken: string;
}): Promise<void> {
  const { admin, jobId, userId, siteId, input, apiKey, userAccessToken } = opts;
  const job = makeJobUpdater(admin, jobId);
  // For brand-new users the account_id equals user.id (matches the
  // fallback at app/api/account/list/route.ts). Content endpoints reject
  // calls that have a Bearer but no account header.
  const accountId = userId;

  try {
    await job.setStep("analyzing_site");
    const scrape = await scrapeSiteMeta(input.domain);
    const enrichedInput: OnboardingFormInput = {
      ...input,
      brand_name: input.brand_name || scrape?.brand_name || input.domain,
      brand_description: input.brand_description || scrape?.brand_description || "",
      content_language: input.content_language || scrape?.content_language || "en",
    };

    await job.setStep("analyzing_brand");
    let brandProfile: BrandProfile | undefined;
    try {
      brandProfile = await generateBrandProfile(apiKey, enrichedInput, scrape?.body_text || "");
    } catch {
      // Profile is "nice to have" — don't fail the whole pipeline if
      // Haiku is having a moment. The user can fill these in Settings.
      brandProfile = undefined;
    }

    await job.setStep("finding_keywords");
    const keywords = await generateKeywords(apiKey, enrichedInput);
    if (keywords.length === 0) {
      throw new Error("Could not generate any keywords for this brand");
    }

    await job.setStep("planning_content");
    const plan = await generatePlan(apiKey, enrichedInput, keywords);

    await job.setStep("writing_article_1");
    const draft1 = await generateDraft(
      apiKey,
      enrichedInput,
      keywords[0],
      plan.find((p) => p.target_keyword.toLowerCase() === keywords[0].text.toLowerCase()),
    );

    await job.setStep("writing_article_2");
    const secondKw = keywords[1] || keywords[0];
    const draft2 = await generateDraft(
      apiKey,
      enrichedInput,
      secondKw,
      plan.find((p) => p.target_keyword.toLowerCase() === secondKw.text.toLowerCase()),
    );

    // Persist the user's form input on the site row BEFORE we touch
    // the SAMA backend. Several backend endpoints (analysis/run,
    // tenant/activate, content/plan/calendar) read brand context from
    // user_sites.settings — the AI visibility runner in particular
    // returns "No queries configured" when settings.geo_queries is
    // empty, regardless of what we put in the request body. Saving
    // now closes that race.
    await persistFormInputEarly(admin, userId, siteId, enrichedInput);

    // All three of the next steps are best-effort. If the SAMA backend
    // is unreachable, we still save the result locally so the review
    // page works — the user can manually re-trigger from Insikter later.
    //
    // Activation MUST run before sync/audits — the backend rejects
    // content_pieces / plan / site-audit writes for tenants that
    // haven't been activated yet, which silently dropped every write
    // the first time we shipped this without an activation call.
    await job.setStep("syncing_calendar");
    const activationError = await activateTenant(siteId, userAccessToken, accountId);
    const tenantActivation: OnboardingResult["tenant_activation"] = {
      succeeded: !activationError,
      error: activationError,
    };

    let backendSync: OnboardingResult["backend_sync"];
    try {
      backendSync = await syncToBackend(siteId, userAccessToken, accountId, enrichedInput, plan, [draft1, draft2]);
    } catch (e) {
      backendSync = {
        attempted: true,
        pieces_created: 0,
        pieces_failed: plan.length + 2,
        error: e instanceof Error ? e.message : "backend sync failed",
      };
    }

    await job.setStep("starting_audits");
    let auditsStarted: OnboardingResult["audits_started"];
    try {
      auditsStarted = await kickOffAudits(siteId, userAccessToken, accountId, enrichedInput);
    } catch (e) {
      auditsStarted = { error: e instanceof Error ? e.message : "audit kickoff failed" };
    }

    await job.setStep("saving");
    const result: OnboardingResult = {
      site_meta: {
        domain: enrichedInput.domain,
        brand_name: enrichedInput.brand_name,
        brand_description: enrichedInput.brand_description,
        content_language: enrichedInput.content_language,
      },
      brand_profile: brandProfile,
      keywords,
      plan,
      drafts: [draft1, draft2],
      generated_at: new Date().toISOString(),
      tenant_activation: tenantActivation,
      backend_sync: backendSync,
      audits_started: auditsStarted,
    };
    await saveResultToSite(admin, userId, siteId, enrichedInput, result);
    await job.finish(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Onboarding generation failed";
    await job.fail(message);
  }
}
