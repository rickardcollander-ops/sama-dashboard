import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FETCH_TIMEOUT_MS = 8_000;
const MAX_BYTES = 1_500_000;

function normalizeDomain(input: string): { url: string; host: string } | null {
  if (!input) return null;
  let raw = input.trim();
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  const host = parsed.hostname.toLowerCase();
  if (!host || host === "localhost" || host.endsWith(".localhost")) return null;
  // Block IP literals targeting private / loopback / link-local ranges
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    const [a, b] = host.split(".").map(Number);
    if (a === 10) return null;
    if (a === 127) return null;
    if (a === 0) return null;
    if (a === 169 && b === 254) return null;
    if (a === 172 && b >= 16 && b <= 31) return null;
    if (a === 192 && b === 168) return null;
  }
  if (host.includes(":")) return null; // reject IPv6 literals to avoid SSRF edge cases
  return { url: parsed.toString(), host };
}

async function fetchHtml(url: string): Promise<{ html: string; status: number; finalUrl: string }> {
  const res = await fetch(url, {
    method: "GET",
    redirect: "follow",
    headers: {
      "User-Agent": "SamaAuditBot/1.0 (+https://sama.example/audit)",
      Accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  const reader = res.body?.getReader();
  if (!reader) {
    return { html: "", status: res.status, finalUrl: res.url };
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.byteLength;
      if (total >= MAX_BYTES) {
        await reader.cancel().catch(() => {});
        break;
      }
    }
  }
  const buf = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    buf.set(c, offset);
    offset += c.byteLength;
  }
  const html = new TextDecoder("utf-8", { fatal: false }).decode(buf);
  return { html, status: res.status, finalUrl: res.url };
}

interface AuditFinding {
  id: string;
  severity: "high" | "medium" | "low" | "good";
  title: string;
  detail: string;
}

interface PageSignals {
  title: string | null;
  titleLength: number;
  metaDescription: string | null;
  metaDescriptionLength: number;
  h1: string | null;
  h1Count: number;
  h2Count: number;
  wordCount: number;
  hasViewport: boolean;
  hasLang: boolean;
  hasOpenGraph: boolean;
  hasTwitterCard: boolean;
  hasCanonical: boolean;
  schemaTypes: string[];
  imageCount: number;
  imagesMissingAlt: number;
}

function extractSignals(html: string): PageSignals {
  const pick = (re: RegExp): string | null => {
    const m = html.match(re);
    return m ? m[1].trim() : null;
  };

  const title = pick(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const metaDescription = pick(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i)
    || pick(/<meta[^>]+content=["']([^"']*)["'][^>]*name=["']description["']/i);

  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const h1 = h1Match ? h1Match[1].replace(/<[^>]+>/g, "").trim() : null;
  const h1Count = (html.match(/<h1\b/gi) || []).length;
  const h2Count = (html.match(/<h2\b/gi) || []).length;

  const hasViewport = /<meta[^>]+name=["']viewport["']/i.test(html);
  const hasLang = /<html[^>]+lang=/i.test(html);
  const hasOpenGraph = /<meta[^>]+property=["']og:/i.test(html);
  const hasTwitterCard = /<meta[^>]+name=["']twitter:card["']/i.test(html);
  const hasCanonical = /<link[^>]+rel=["']canonical["']/i.test(html);

  const schemaTypes: string[] = [];
  const ldRe = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = ldRe.exec(html)) !== null) {
    try {
      const json = JSON.parse(m[1].trim());
      const collect = (n: unknown) => {
        if (!n || typeof n !== "object") return;
        const obj = n as Record<string, unknown>;
        if (typeof obj["@type"] === "string") schemaTypes.push(obj["@type"]);
        if (Array.isArray(obj["@type"])) {
          for (const t of obj["@type"]) if (typeof t === "string") schemaTypes.push(t);
        }
        if (Array.isArray(obj["@graph"])) for (const g of obj["@graph"]) collect(g);
      };
      if (Array.isArray(json)) json.forEach(collect);
      else collect(json);
    } catch {
      // malformed JSON-LD — ignore
    }
  }

  const imageCount = (html.match(/<img\b/gi) || []).length;
  const imagesMissingAlt = (html.match(/<img\b(?![^>]*\balt=)[^>]*>/gi) || []).length;

  // crude word count from visible text
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const wordCount = text ? text.split(" ").length : 0;

  return {
    title,
    titleLength: title?.length ?? 0,
    metaDescription,
    metaDescriptionLength: metaDescription?.length ?? 0,
    h1,
    h1Count,
    h2Count,
    wordCount,
    hasViewport,
    hasLang,
    hasOpenGraph,
    hasTwitterCard,
    hasCanonical,
    schemaTypes: Array.from(new Set(schemaTypes)),
    imageCount,
    imagesMissingAlt,
  };
}

function scoreSignals(s: PageSignals): { overall: number; seo: number; geo: number; technical: number; findings: AuditFinding[] } {
  const findings: AuditFinding[] = [];
  let seo = 0, geo = 0, technical = 0;

  // SEO (max 40)
  if (s.title && s.titleLength >= 20 && s.titleLength <= 65) {
    seo += 12;
    findings.push({ id: "title-good", severity: "good", title: "Bra title-tagg", detail: `${s.titleLength} tecken — i sweet spot för SERP-visning.` });
  } else if (s.title) {
    seo += 6;
    findings.push({ id: "title-len", severity: "medium", title: "Justera title-längd", detail: `${s.titleLength} tecken — sikta på 30–60 så den inte trunkeras.` });
  } else {
    findings.push({ id: "title-missing", severity: "high", title: "Ingen title-tagg", detail: "Saknas — Google och AI-motorer behöver detta för att förstå sidan." });
  }

  if (s.metaDescription && s.metaDescriptionLength >= 70 && s.metaDescriptionLength <= 170) {
    seo += 10;
    findings.push({ id: "meta-good", severity: "good", title: "Bra meta description", detail: `${s.metaDescriptionLength} tecken.` });
  } else if (s.metaDescription) {
    seo += 5;
    findings.push({ id: "meta-len", severity: "medium", title: "Meta description fel längd", detail: `${s.metaDescriptionLength} tecken — sikta på 120–160.` });
  } else {
    findings.push({ id: "meta-missing", severity: "high", title: "Saknar meta description", detail: "Påverkar CTR både i Google och i AI-sammanfattningar." });
  }

  if (s.h1Count === 1) {
    seo += 8;
  } else if (s.h1Count === 0) {
    findings.push({ id: "h1-missing", severity: "high", title: "Ingen H1-rubrik", detail: "Lägg till en tydlig H1 som sammanfattar sidan." });
  } else {
    seo += 4;
    findings.push({ id: "h1-multi", severity: "medium", title: `${s.h1Count} H1-taggar`, detail: "Rekommenderat: exakt en H1 per sida." });
  }

  if (s.wordCount >= 400) seo += 10;
  else findings.push({ id: "thin-content", severity: "medium", title: "Tunt innehåll", detail: `${s.wordCount} ord — sikta på minst 400 så AI-motorer har något att citera.` });

  // GEO / AI-readiness (max 40)
  if (s.schemaTypes.length > 0) {
    geo += 16;
    findings.push({ id: "schema-good", severity: "good", title: "Schema.org-markup hittad", detail: `Typer: ${s.schemaTypes.slice(0, 5).join(", ")}` });
  } else {
    findings.push({ id: "schema-missing", severity: "high", title: "Inget schema.org JSON-LD", detail: "Lägg till Organization, FAQPage eller Article — det är så ChatGPT, Perplexity och Gemini citerar dig." });
  }

  if (s.hasOpenGraph) geo += 8;
  else findings.push({ id: "og-missing", severity: "medium", title: "Saknar Open Graph", detail: "AI-motorer och delningar plockar ofta bilder/titlar från og:-taggar." });

  if (s.hasTwitterCard) geo += 4;

  // Heuristic: AI engines reward FAQ / How-to / Article schema
  const aiFriendly = s.schemaTypes.some(t => /^(FAQPage|HowTo|Article|Product|Organization)$/i.test(t));
  if (aiFriendly) geo += 12;
  else if (s.schemaTypes.length > 0) {
    geo += 6;
    findings.push({ id: "schema-weak", severity: "medium", title: "Schema finns men inte AI-vänlig", detail: "Lägg till FAQPage eller Article — de citeras oftast av AI-motorer." });
  }

  // Technical (max 20)
  if (s.hasViewport) technical += 5;
  else findings.push({ id: "viewport", severity: "medium", title: "Saknar viewport meta", detail: "Sidan kanske inte är mobil-optimerad." });

  if (s.hasLang) technical += 5;
  else findings.push({ id: "lang", severity: "low", title: "Saknar lang-attribut på <html>", detail: "Hjälper sökmotorer förstå språket." });

  if (s.hasCanonical) technical += 5;
  else findings.push({ id: "canonical", severity: "low", title: "Saknar canonical-länk", detail: "Förhindrar duplicate content-problem." });

  if (s.imageCount === 0 || s.imagesMissingAlt === 0) technical += 5;
  else findings.push({ id: "alt", severity: "medium", title: `${s.imagesMissingAlt} bilder utan alt-text`, detail: "Lägg till alt-text — viktigt för tillgänglighet och AI-tolkning." });

  const overall = seo + geo + technical;
  return { overall, seo, geo, technical, findings };
}

function suggestQueries(s: PageSignals, host: string): string[] {
  const brand = host
    .replace(/^www\./, "")
    .split(".")[0]
    .replace(/-/g, " ");
  const titleHint = (s.title || "").split(/[|\-–—]/)[0].trim().toLowerCase();
  const topic = titleHint && titleHint.length > 4 && titleHint.length < 60 ? titleHint : brand;

  const q = [
    `Vilket är det bästa alternativet till ${brand}?`,
    `${brand} recensioner och omdömen 2026`,
    `${brand} vs konkurrenter – vad ska jag välja?`,
    `Bästa verktygen för ${topic}`,
    `Är ${brand} värt pengarna?`,
  ];
  return q;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const input: string = (body?.domain || "").toString();
  const target = normalizeDomain(input);
  if (!target) {
    return NextResponse.json({ error: "Ogiltig domän. Ange t.ex. exempel.se" }, { status: 400 });
  }

  let fetched: { html: string; status: number; finalUrl: string };
  try {
    fetched = await fetchHtml(target.url);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "okänt fel";
    return NextResponse.json({ error: `Kunde inte hämta sidan: ${msg}` }, { status: 502 });
  }

  if (fetched.status >= 400 || !fetched.html) {
    return NextResponse.json(
      { error: `Servern svarade med HTTP ${fetched.status}. Kontrollera domänen.` },
      { status: 502 },
    );
  }

  const signals = extractSignals(fetched.html);
  const { overall, seo, geo, technical, findings } = scoreSignals(signals);
  const queries = suggestQueries(signals, target.host);

  return NextResponse.json({
    domain: target.host,
    final_url: fetched.finalUrl,
    fetched_at: new Date().toISOString(),
    scores: { overall, seo, geo, technical },
    signals,
    findings,
    suggested_queries: queries,
  });
}
