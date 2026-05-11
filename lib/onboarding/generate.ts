/**
 * Orchestrates the post-onboarding "build the user's starter content"
 * pipeline. Runs four sequential Claude calls:
 *
 *   1. Site meta scrape  → brand_name/description/language fallback
 *   2. Relevant keywords → 12 ranked SEO keywords for the brand
 *   3. 30-day plan       → one content idea per day, mapped to a keyword
 *   4. Two full drafts   → 1500-2500 word articles for the top 2 keywords
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
  keywords: GeneratedKeyword[];
  plan: PlanEntry[];
  drafts: DraftArticle[];
  generated_at: string;
}

type JobStep =
  | "queued"
  | "analyzing_site"
  | "finding_keywords"
  | "planning_content"
  | "writing_article_1"
  | "writing_article_2"
  | "saving"
  | "done";

const STEP_PROGRESS: Record<JobStep, number> = {
  queued: 0,
  analyzing_site: 10,
  finding_keywords: 25,
  planning_content: 45,
  writing_article_1: 65,
  writing_article_2: 85,
  saving: 95,
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
    return {
      brand_name: (og("og:site_name") || title.split(/[|–\-—]/)[0]).trim().slice(0, 80),
      brand_description: (og("og:description") || meta("description")).slice(0, 500),
      content_language: lang || "",
    };
  } catch {
    return null;
  }
}

/**
 * Persists the final result on user_sites.settings under "onboarding_result"
 * (and bumps onboarding_completed_at). Service-role client so this works
 * from a background task without a user session cookie.
 */
async function saveResultToSite(
  admin: SupabaseClient,
  siteId: string,
  formInput: OnboardingFormInput,
  result: OnboardingResult,
): Promise<void> {
  const { data: row } = await admin
    .from("user_sites")
    .select("settings")
    .eq("id", siteId)
    .single();
  const settings = ((row?.settings as Record<string, unknown>) || {}) as Record<string, unknown>;

  const next = {
    ...settings,
    domain: formInput.domain,
    brand_name: formInput.brand_name,
    brand_description: formInput.brand_description,
    target_audience: formInput.target_audience,
    content_language: formInput.content_language,
    competitors: formInput.competitors,
    geo_queries: formInput.geo_queries.length > 0
      ? formInput.geo_queries
      : (Array.isArray(settings.geo_queries) ? settings.geo_queries : []),
    geo_platforms: Array.isArray(settings.geo_platforms) && settings.geo_platforms.length > 0
      ? settings.geo_platforms
      : ["ChatGPT", "Perplexity", "Claude", "Google AIO"],
    brand_color: formInput.brand_color || (settings.brand_color as string) || "",
    example_article_url:
      formInput.example_article_url || (settings.example_article_url as string) || "",
    onboarding_completed_at: new Date().toISOString(),
    onboarding_result: result,
  };

  await admin
    .from("user_sites")
    .update({ settings: next, updated_at: new Date().toISOString() })
    .eq("id", siteId);
}

export async function runOnboardingGeneration(opts: {
  admin: SupabaseClient;
  jobId: string;
  siteId: string;
  input: OnboardingFormInput;
  apiKey: string;
}): Promise<void> {
  const { admin, jobId, siteId, input, apiKey } = opts;
  const job = makeJobUpdater(admin, jobId);

  try {
    await job.setStep("analyzing_site");
    const scrape = await scrapeSiteMeta(input.domain);
    const enrichedInput: OnboardingFormInput = {
      ...input,
      brand_name: input.brand_name || scrape?.brand_name || input.domain,
      brand_description: input.brand_description || scrape?.brand_description || "",
      content_language: input.content_language || scrape?.content_language || "en",
    };

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

    await job.setStep("saving");
    const result: OnboardingResult = {
      site_meta: {
        domain: enrichedInput.domain,
        brand_name: enrichedInput.brand_name,
        brand_description: enrichedInput.brand_description,
        content_language: enrichedInput.content_language,
      },
      keywords,
      plan,
      drafts: [draft1, draft2],
      generated_at: new Date().toISOString(),
    };
    await saveResultToSite(admin, siteId, enrichedInput, result);
    await job.finish(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Onboarding generation failed";
    await job.fail(message);
  }
}
