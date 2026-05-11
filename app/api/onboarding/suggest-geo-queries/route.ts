import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Quick suggestion call — Haiku takes 2-4s.
export const maxDuration = 30;

const SYSTEM = `You are a senior GEO (Generative Engine Optimization) strategist. You suggest 5 natural-language prompts a buyer would ask ChatGPT/Claude/Perplexity/Gemini when researching the brand's category — *before* they've heard of the brand.

Hard rules:
- NEVER include the brand's name or domain in any query (those bias the AI's answer).
- Phrase each query the way a real buyer in the target audience would — full sentence, like a question or "best X for Y" request.
- Cover different angles: category, comparison, problem statement, "how to choose", "alternatives to <competitor>".
- Output in the brand's content language.
Always reply by calling submit_queries — never plain text.`;

const TOOL_SCHEMA = {
  type: "object" as const,
  properties: {
    queries: {
      type: "array",
      items: { type: "string" },
      minItems: 5,
      maxItems: 5,
    },
  },
  required: ["queries"],
};

interface Body {
  brand_name?: string;
  domain?: string;
  brand_description?: string;
  target_audience?: string;
  content_language?: string;
  competitors?: string[];
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI service is not configured." },
      { status: 500 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const brandName = (body.brand_name || "").trim();
  const domain = (body.domain || "").trim();
  const description = (body.brand_description || "").trim();
  const audience = (body.target_audience || "").trim();
  const language = (body.content_language || "en").trim();
  const competitors = Array.isArray(body.competitors)
    ? body.competitors.filter((c): c is string => typeof c === "string").slice(0, 6)
    : [];

  if (!description && !brandName && !domain) {
    return NextResponse.json({ queries: [] });
  }

  const userMsg = `Brand: ${brandName || "(unknown)"}
Domain: ${domain || "(unknown)"}
Description: ${description || "(none)"}
Target audience: ${audience || "(general)"}
Output language: ${language}
Competitors (you may name them in queries, but NEVER the brand itself): ${competitors.join(", ") || "(none)"}

Produce exactly 5 AI tracking queries.`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 600,
        system: SYSTEM,
        messages: [{ role: "user", content: userMsg }],
        tools: [
          {
            name: "submit_queries",
            description: "Submit the 5 GEO tracking queries.",
            input_schema: TOOL_SCHEMA,
          },
        ],
        tool_choice: { type: "tool", name: "submit_queries" },
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        { error: `Anthropic ${res.status}: ${text.slice(0, 200)}` },
        { status: 502 },
      );
    }
    const data = await res.json();
    const blocks = Array.isArray(data.content) ? data.content : [];
    const toolUse = blocks.find(
      (b: { type?: string; name?: string }) =>
        b?.type === "tool_use" && b?.name === "submit_queries",
    ) as { input?: { queries?: string[] } } | undefined;
    const raw = toolUse?.input?.queries ?? [];
    const brandTokens = [brandName, domain, domain.split(".")[0]]
      .filter(Boolean)
      .map((s) => s.toLowerCase());
    const queries = raw
      .filter((q): q is string => typeof q === "string" && q.trim().length > 0)
      .map((q) => q.trim())
      .filter((q) => {
        const lower = q.toLowerCase();
        return !brandTokens.some((t) => t.length >= 3 && lower.includes(t));
      })
      .slice(0, 5);
    return NextResponse.json({ queries });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not generate queries" },
      { status: 500 },
    );
  }
}
