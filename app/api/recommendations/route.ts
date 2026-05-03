import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, loadSettings } from "@/lib/integrations/store";

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
- Output STRICT JSON, no prose, matching the requested schema.`;

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

${input.gap_summary ? `Recent analysis gaps:\n${input.gap_summary}\n` : ""}
Return JSON:
{
  "keywords": [{"text": string, "reason": string, "intent": "informational|commercial|transactional|navigational", "type": "head|long_tail|question|comparison", "priority": "high|medium|low"}, ...${input.count_keywords} items],
  "geo_queries": [{"text": string, "reason": string, "intent": "informational|commercial|transactional|navigational", "priority": "high|medium|low"}, ...${input.count_geo} items],
  "long_tail_phrases": [{"text": string, "reason": string, "intent": "informational|commercial|transactional|navigational", "priority": "high|medium|low"}, ...${input.count_long_tail} items]
}`;
}

async function callAnthropic(apiKey: string, system: string, user: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Anthropic ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  const content = data.content?.[0]?.text || "";
  return content;
}

function safeParse(text: string): Recommendations | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    return {
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
      geo_queries: Array.isArray(parsed.geo_queries) ? parsed.geo_queries : [],
      long_tail_phrases: Array.isArray(parsed.long_tail_phrases) ? parsed.long_tail_phrases : [],
    };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const settings = await loadSettings(user.id);
  const str = (k: string) => (typeof settings[k] === "string" ? (settings[k] as string) : "");
  const arr = (k: string) =>
    Array.isArray(settings[k]) ? (settings[k] as unknown[]).filter((v): v is string => typeof v === "string") : [];

  const apiKey = str("anthropic_api_key") || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "No Anthropic API key configured. Add one in Settings → AI Platform Access (Advanced) or set ANTHROPIC_API_KEY.",
      },
      { status: 400 },
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
    const raw = await callAnthropic(apiKey, SYSTEM_PROMPT, prompt);
    const parsed = safeParse(raw);
    if (!parsed) {
      return NextResponse.json({ error: "Could not parse model response", raw }, { status: 502 });
    }

    const existingLower = new Set([
      ...existingKeywords.map((k) => k.toLowerCase()),
      ...existingGeo.map((k) => k.toLowerCase()),
    ]);
    const dedupe = (items: RecommendationItem[]) =>
      items.filter((it) => it && typeof it.text === "string" && !existingLower.has(it.text.toLowerCase()));

    return NextResponse.json({
      keywords: dedupe(parsed.keywords),
      geo_queries: dedupe(parsed.geo_queries),
      long_tail_phrases: dedupe(parsed.long_tail_phrases),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Recommendation failed" },
      { status: 500 },
    );
  }
}
