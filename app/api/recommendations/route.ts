import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/integrations/store";
import { getSiteSettingsAccess, resolveSiteId } from "@/lib/integrations/site-context";

export const runtime = "nodejs";

interface RecommendationItem {
  text: string;
  reason: string;
  intent?: "informational" | "commercial" | "transactional" | "navigational";
  type?: "head" | "long_tail" | "question" | "comparison";
  priority?: "high" | "medium" | "low";
}

interface Recommendations {
  keywords: RecommendationItem[];
  geo_queries: RecommendationItem[];
  long_tail_phrases: RecommendationItem[];
}

const SYSTEM_PROMPT = `You are a senior SEO + GEO (Generative Engine Optimization) strategist.
You suggest NEW keyword opportunities and NEW prompt-style queries to track in AI assistants
(ChatGPT, Claude, Perplexity, Gemini, Google AI Overviews) for a specific brand.

Rules:
- NEVER repeat anything from the provided "existing_keywords" or "existing_geo_queries" lists.
- Keywords are short search terms (2–5 words) people type into Google.
- GEO queries are full natural-language prompts/questions a user would ask an AI assistant.
- Long-tail phrases are 5+ word search terms with clear buyer intent.
- Each item must have a one-sentence reason explaining WHY it's a useful addition.
- Bias toward terms where the brand has a real chance of being mentioned (relevant to brand description, audience, USPs).
- If gap_summary is provided, prioritize themes where competitors win and the brand loses.
- CRITICAL: "geo_queries" are sent verbatim to AI assistants to measure unbiased brand visibility.
  geo_queries MUST NOT contain the brand name, domain, or any obvious brand identifier — if the AI
  sees the brand in the prompt, the result is biased and worthless. Phrase geo_queries from the
  perspective of a buyer who has NOT yet heard of the brand (category-level questions, problem
  statements, "best X for Y" comparisons against competitors, etc.).
- Always respond by calling the submit_recommendations tool — never as plain text.`;

function buildUserPrompt(input: {
  brand_name: string;
  domain: string;
  brand_description: string;
  target_audience: string;
  unique_selling_points: string;
  competitors: string[];
  language: string;
  existing_keywords: string[];
  existing_geo_queries: string[];
  gap_summary?: string;
  count_keywords: number;
  count_geo: number;
  count_long_tail: number;
}) {
  return `Brand: ${input.brand_name || "(unknown)"}
Domain: ${input.domain || "(unknown)"}
Description: ${input.brand_description || "(none)"}
Target audience: ${input.target_audience || "(none)"}
USPs: ${input.unique_selling_points || "(none)"}
Competitors: ${input.competitors.join(", ") || "(none)"}
Output language: ${input.language || "en"}

Existing keywords (DO NOT REPEAT):
${input.existing_keywords.slice(0, 80).map((k) => `- ${k}`).join("\n") || "(none)"}

Existing GEO queries (DO NOT REPEAT):
${input.existing_geo_queries.slice(0, 40).map((q) => `- ${q}`).join("\n") || "(none)"}

Reminder: geo_queries MUST NOT contain "${input.brand_name || ""}" or "${input.domain || ""}" — these queries are sent to AI assistants to measure unbiased visibility, so they have to read like a buyer who has never heard of the brand.

${input.gap_summary ? `Recent analysis gaps:\n${input.gap_summary}\n` : ""}
Produce roughly ${input.count_keywords} keywords, ${input.count_geo} GEO queries, and ${input.count_long_tail} long-tail phrases. Submit by calling the submit_recommendations tool.`;
}

// Tool schema mirrors the Recommendations interface. Using tool_choice
// pins the response to a tool_use block, so we get structured JSON
// instead of a free-form text answer that may include prose, markdown
// fences, or get truncated mid-object.
const RECOMMENDATIONS_TOOL = {
  name: "submit_recommendations",
  description:
    "Return the keyword, GEO query and long-tail recommendations. Always call this exactly once.",
  input_schema: {
    type: "object" as const,
    properties: {
      keywords: {
        type: "array",
        items: {
          type: "object",
          properties: {
            text: { type: "string" },
            reason: { type: "string" },
            intent: {
              type: "string",
              enum: ["informational", "commercial", "transactional", "navigational"],
            },
            type: {
              type: "string",
              enum: ["head", "long_tail", "question", "comparison"],
            },
            priority: { type: "string", enum: ["high", "medium", "low"] },
          },
          required: ["text", "reason"],
        },
      },
      geo_queries: {
        type: "array",
        items: {
          type: "object",
          properties: {
            text: { type: "string" },
            reason: { type: "string" },
            intent: {
              type: "string",
              enum: ["informational", "commercial", "transactional", "navigational"],
            },
            priority: { type: "string", enum: ["high", "medium", "low"] },
          },
          required: ["text", "reason"],
        },
      },
      long_tail_phrases: {
        type: "array",
        items: {
          type: "object",
          properties: {
            text: { type: "string" },
            reason: { type: "string" },
            intent: {
              type: "string",
              enum: ["informational", "commercial", "transactional", "navigational"],
            },
            priority: { type: "string", enum: ["high", "medium", "low"] },
          },
          required: ["text", "reason"],
        },
      },
    },
    required: ["keywords", "geo_queries", "long_tail_phrases"],
  },
};

async function callAnthropic(
  apiKey: string,
  system: string,
  user: string,
): Promise<Recommendations | null> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      // Bumped from 2000 — at ~8 keywords + 8 GEO queries + 6 long-tail
      // each carrying a one-sentence reason, the JSON was getting
      // truncated mid-object on Sonnet, which is what surfaced as the
      // "Could not parse model response" 502.
      max_tokens: 4000,
      system,
      messages: [{ role: "user", content: user }],
      tools: [RECOMMENDATIONS_TOOL],
      tool_choice: { type: "tool", name: RECOMMENDATIONS_TOOL.name },
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Anthropic ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();

  // Preferred path: tool_use block with structured input.
  const blocks = Array.isArray(data.content) ? data.content : [];
  const toolUse = blocks.find(
    (b: { type?: string; name?: string }) =>
      b?.type === "tool_use" && b?.name === RECOMMENDATIONS_TOOL.name,
  ) as { input?: unknown } | undefined;
  if (toolUse?.input && typeof toolUse.input === "object") {
    return normalize(toolUse.input as Record<string, unknown>);
  }

  // Fallback: model ignored tool_choice and replied with text. Try to
  // extract JSON anyway so a single misbehaving response doesn't 502.
  const textBlock = blocks.find(
    (b: { type?: string; text?: string }) => b?.type === "text" && typeof b?.text === "string",
  ) as { text?: string } | undefined;
  return safeParseText(textBlock?.text || "");
}

function normalize(parsed: Record<string, unknown>): Recommendations {
  return {
    keywords: Array.isArray(parsed.keywords) ? (parsed.keywords as RecommendationItem[]) : [],
    geo_queries: Array.isArray(parsed.geo_queries)
      ? (parsed.geo_queries as RecommendationItem[])
      : [],
    long_tail_phrases: Array.isArray(parsed.long_tail_phrases)
      ? (parsed.long_tail_phrases as RecommendationItem[])
      : [],
  };
}

function brandIdentityTokens(brandName: string, domain: string): string[] {
  const tokens = new Set<string>();
  const add = (s: string) => {
    const t = s.trim().toLowerCase();
    if (t.length >= 3) tokens.add(t);
  };
  if (brandName) add(brandName);
  if (domain) {
    const host = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (host) {
      add(host);
      const root = host.split(".")[0];
      if (root) add(root);
    }
  }
  return Array.from(tokens);
}

function safeParseText(text: string): Recommendations | null {
  if (!text) return null;
  // Strip ```json ... ``` or ``` ... ``` fences, then try to JSON.parse
  // the inside. Falls back to the first {...} block if the model
  // sandwiched JSON between prose.
  let cleaned = text.trim();
  const fence = cleaned.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fence) cleaned = fence[1].trim();
  try {
    return normalize(JSON.parse(cleaned));
  } catch {
    /* fall through */
  }
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return normalize(JSON.parse(match[0]));
  } catch {
    return null;
  }
}

/**
 * Per-user/per-day call cap to prevent runaway AI usage. Stored in-memory
 * (resets on each Lambda cold start) — good enough as a safety net; pair
 * with the hard-cap on input/output tokens below.
 */
const DAILY_CAP_PER_USER = Number(process.env.RECOMMENDATIONS_DAILY_CAP || 30);
const usage = new Map<string, { day: string; count: number }>();

function checkUsage(userId: string): { ok: boolean; remaining: number; cap: number } {
  const day = new Date().toISOString().slice(0, 10);
  const cur = usage.get(userId);
  if (!cur || cur.day !== day) {
    usage.set(userId, { day, count: 1 });
    return { ok: true, remaining: DAILY_CAP_PER_USER - 1, cap: DAILY_CAP_PER_USER };
  }
  cur.count += 1;
  return {
    ok: cur.count <= DAILY_CAP_PER_USER,
    remaining: Math.max(0, DAILY_CAP_PER_USER - cur.count),
    cap: DAILY_CAP_PER_USER,
  };
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const u = checkUsage(user.id);
  if (!u.ok) {
    return NextResponse.json(
      {
        error: `Daily cap reached (${u.cap} AI suggestion requests per day).`,
        hint: "Raise RECOMMENDATIONS_DAILY_CAP env var if you need more.",
      },
      { status: 429 },
    );
  }

  const body = await req.json().catch(() => ({}));

  // Brand context lives on the active site row, not on the caller's user
  // row — admin view-as sends a different X-Sama-Site-Id than user.id and
  // we must honour it or the LLM gets the wrong tenant's brand.
  const siteId = resolveSiteId(req, user.id);
  let settings: Record<string, unknown> = {};
  try {
    settings = (await getSiteSettingsAccess(user, siteId)).settings;
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not load tenant settings" },
      { status: 500 },
    );
  }

  const str = (k: string) => (typeof settings[k] === "string" ? (settings[k] as string) : "");
  const arr = (k: string) =>
    Array.isArray(settings[k]) ? (settings[k] as unknown[]).filter((v): v is string => typeof v === "string") : [];

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "AI service is not configured. Please contact support.",
      },
      { status: 500 },
    );
  }

  const existingKeywords: string[] = Array.isArray(body.existing_keywords)
    ? body.existing_keywords
    : [];
  const existingGeo: string[] = arr("geo_queries");
  const competitors = arr("competitors");

  const prompt = buildUserPrompt({
    brand_name: str("brand_name"),
    domain: str("domain"),
    brand_description: str("brand_description"),
    target_audience: str("target_audience"),
    unique_selling_points: str("unique_selling_points"),
    competitors,
    language: str("content_language") || "en",
    existing_keywords: existingKeywords,
    existing_geo_queries: existingGeo,
    gap_summary: typeof body.gap_summary === "string" ? body.gap_summary : undefined,
    count_keywords: Math.min(Math.max(Number(body.count_keywords) || 8, 3), 20),
    count_geo: Math.min(Math.max(Number(body.count_geo) || 8, 3), 20),
    count_long_tail: Math.min(Math.max(Number(body.count_long_tail) || 6, 0), 15),
  });

  try {
    const parsed = await callAnthropic(apiKey, SYSTEM_PROMPT, prompt);
    if (!parsed) {
      return NextResponse.json(
        { error: "Could not parse model response" },
        { status: 502 },
      );
    }

    const existingLower = new Set([
      ...existingKeywords.map((k) => k.toLowerCase()),
      ...existingGeo.map((k) => k.toLowerCase()),
    ]);
    const dedupe = (items: RecommendationItem[]) =>
      items.filter((it) => it && typeof it.text === "string" && !existingLower.has(it.text.toLowerCase()));

    const brandTokens = brandIdentityTokens(str("brand_name"), str("domain"));
    const stripBrand = (items: RecommendationItem[]) =>
      brandTokens.length === 0
        ? items
        : items.filter((it) => {
            const t = it.text.toLowerCase();
            return !brandTokens.some((token) => t.includes(token));
          });

    return NextResponse.json({
      keywords: dedupe(parsed.keywords),
      geo_queries: stripBrand(dedupe(parsed.geo_queries)),
      long_tail_phrases: dedupe(parsed.long_tail_phrases),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Recommendation failed" },
      { status: 500 },
    );
  }
}
