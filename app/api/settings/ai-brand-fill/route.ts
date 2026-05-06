import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPPORTED_LANGS = new Set(["sv", "en", "de", "fr", "es", "no", "da", "fi", "nl", "pl", "it", "pt"]);

async function fetchSiteHtml(domain: string): Promise<string> {
  const url = `https://${domain.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").toLowerCase()}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; SAMABot/1.0; +https://sama.ai)" },
    signal: AbortSignal.timeout(8_000),
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function extractBasicMeta(html: string) {
  const attr = (tag: string, attrPat: string) => {
    const re = new RegExp(`<${tag}[^>]+${attrPat}[^>]+content=["']([^"']{1,500})["']`, "i");
    const m = html.match(re) ?? html.match(new RegExp(`<${tag}[^>]+content=["']([^"']{1,500})["'][^>]+${attrPat}`, "i"));
    return m?.[1]?.trim() ?? "";
  };
  const ogSiteName = attr("meta", `property=["']og:site_name["']`);
  const ogDesc = attr("meta", `property=["']og:description["']`);
  const metaDesc = attr("meta", `name=["']description["']`);
  const rawTitle = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i)?.[1]?.trim() ?? "";
  const htmlLang = html.match(/<html[^>]+lang=["']([a-z]{2,5})(?:-[^"']+)?["']/i)?.[1]?.toLowerCase() ?? "";
  const brandName = (ogSiteName || rawTitle.split(/[|–\-—]/)[0]).trim().slice(0, 80);
  const description = (ogDesc || metaDesc).trim().slice(0, 1000);
  const lang = SUPPORTED_LANGS.has(htmlLang) ? htmlLang : "sv";
  // Extract visible text (rough)
  const bodyText = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 3000);
  return { brandName, description, lang, bodyText };
}

async function callClaude(apiKey: string, domain: string, html: { brandName: string; description: string; lang: string; bodyText: string }) {
  const system = `You are a brand analyst. Given a website's content, extract and infer brand information.
Respond ONLY with a valid JSON object — no prose, no markdown fences.`;

  const user = `Analyze this website and return a JSON object with these fields:
- brand_name: string (the company/brand name)
- brand_description: string (2-3 sentences describing what the company does)
- business_type: one of: "ecommerce", "local_service", "saas", "media", "agency", "consulting", "non_profit", "other"
- target_audience: string (who their customers are, 1-2 sentences)
- unique_selling_points: string (what makes them unique, 1-2 sentences)
- tone_of_voice: one of: "professional", "casual", "technical", "friendly", "bold"
- language: string (2-letter ISO code for the site's main language, e.g. "sv", "en")
- competitors: array of 3-5 strings (likely competitor brand names or domains, based on the industry)

Website domain: ${domain}
Brand name from HTML: ${html.brandName}
Meta description: ${html.description}
Page content excerpt: ${html.bodyText}

Return only the JSON object.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1000,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) throw new Error(`Claude ${res.status}`);
  const data = await res.json();
  return data.content?.[0]?.text || "";
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const domain = (body?.domain ?? "").toString().trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "").toLowerCase();
  if (!domain) return NextResponse.json({ error: "domain required" }, { status: 400 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 503 });

  try {
    const html = await fetchSiteHtml(domain);
    const meta = extractBasicMeta(html);
    const raw = await callClaude(apiKey, domain, meta);
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON in response");
    const result = JSON.parse(match[0]);
    return NextResponse.json({
      brand_name: result.brand_name || meta.brandName || "",
      brand_description: result.brand_description || meta.description || "",
      business_type: result.business_type || "other",
      target_audience: result.target_audience || "",
      unique_selling_points: result.unique_selling_points || "",
      tone_of_voice: result.tone_of_voice || "professional",
      language: result.language || meta.lang || "sv",
      competitors: Array.isArray(result.competitors) ? result.competitors.slice(0, 5) : [],
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}
