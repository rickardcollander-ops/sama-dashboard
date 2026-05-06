import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPPORTED_LANGS = new Set(["sv","en","de","fr","es","no","da","fi","nl","pl","it","pt"]);

function extractMeta(html: string, domain: string) {
  const attr = (tag: string, attrPat: string) => {
    const re = new RegExp(`<${tag}[^>]+${attrPat}[^>]+content=["']([^"']{1,500})["']`, "i");
    const m = html.match(re) ?? html.match(new RegExp(`<${tag}[^>]+content=["']([^"']{1,500})["'][^>]+${attrPat}`, "i"));
    return m?.[1]?.trim() ?? "";
  };

  const ogSiteName  = attr("meta", `property=["']og:site_name["']`);
  const ogDesc      = attr("meta", `property=["']og:description["']`);
  const metaDesc    = attr("meta", `name=["']description["']`);
  const rawTitle    = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i)?.[1]?.trim() ?? "";
  const htmlLang    = html.match(/<html[^>]+lang=["']([a-z]{2,5})(?:-[^"']+)?["']/i)?.[1]?.toLowerCase() ?? "";

  const brandName = (ogSiteName || rawTitle.split(/[|–\-—]/)[0]).trim().slice(0, 80);
  const brandDesc = (ogDesc || metaDesc).trim().slice(0, 500);
  const lang = SUPPORTED_LANGS.has(htmlLang) ? htmlLang : "en";

  const brandSlug = domain.replace(/^www\./, "").split(".")[0].replace(/-/g, " ");
  const topicHint = rawTitle.split(/[|–\-—]/)[0].trim().toLowerCase();
  const topic = topicHint.length > 4 && topicHint.length < 60 ? topicHint : brandSlug;

  const suggestedQueries = [
    `Vilket är det bästa alternativet till ${brandSlug}?`,
    `${brandSlug} recensioner och omdömen 2026`,
    `${brandSlug} vs konkurrenter – vad ska jag välja?`,
    `Bästa verktygen för ${topic}`,
    `Är ${brandSlug} värt pengarna?`,
  ];

  return { brand_name: brandName, brand_description: brandDesc, content_language: lang, suggested_queries: suggestedQueries };
}

export async function POST(req: NextRequest) {
  // Require auth
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const raw = (body?.domain ?? "").toString().trim();
  if (!raw) return NextResponse.json({ brand_name: "", brand_description: "", content_language: "en", suggested_queries: [] });

  const domain = raw.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").toLowerCase();
  const url = `https://${domain}`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SAMABot/1.0; +https://sama.ai)" },
      signal: AbortSignal.timeout(8_000),
      redirect: "follow",
    });
    if (!res.ok) return NextResponse.json({ brand_name: "", brand_description: "", content_language: "en", suggested_queries: [] });
    const html = await res.text();
    return NextResponse.json(extractMeta(html, domain));
  } catch {
    return NextResponse.json({ brand_name: "", brand_description: "", content_language: "en", suggested_queries: [] });
  }
}
