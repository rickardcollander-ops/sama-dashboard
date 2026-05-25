/**
 * Internal-link weaving from the site's own sitemap.
 *
 * Articles are authored by the SAMA backend and arrive without internal links.
 * This module fetches the customer's real sitemap, derives a relevant anchor
 * phrase for each page, and weaves links into article markdown — but only where
 * the phrase literally appears in the prose. That keeps every inserted link
 * (a) real (the URL comes straight from the sitemap, never invented) and
 * (b) contextually relevant (the anchor text equals the target page's topic).
 *
 * Everything is best-effort: any network/parse failure degrades to "no links
 * added" rather than blocking the article.
 */

export interface SitemapEntry {
  url: string; // absolute URL, no trailing slash
  path: string; // pathname, no trailing slash, lowercased
  phrase: string; // lowercased anchor phrase derived from the slug
}

const DEFAULT_MAX_LINKS = 5;
const SITEMAP_TIMEOUT_MS = 8_000;
const MAX_CHILD_SITEMAPS = 12;
const MAX_ENTRIES = 500;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1h

// Slugs that describe navigation/legal/utility pages rather than topics. Linking
// an "about" or "contact" mention into prose is noise, so we never use them.
const GENERIC_SLUGS = new Set([
  "home", "index", "blog", "blogg", "about", "about-us", "om-oss", "contact",
  "contact-us", "kontakt", "privacy", "privacy-policy", "integritetspolicy",
  "terms", "terms-of-service", "villkor", "cookies", "cookie-policy", "login",
  "log-in", "signin", "sign-in", "signup", "sign-up", "register", "cart",
  "checkout", "search", "sok", "faq", "faqs", "sitemap", "services", "tjanster",
  "products", "produkter", "shop", "butik", "news", "nyheter", "category",
  "categories", "kategori", "tag", "tags", "author", "page", "pages", "start",
]);

const FILE_EXT_RE = /\.(jpe?g|png|gif|svg|webp|avif|pdf|xml|json|css|js|ico|mp4|webm|zip)$/i;
const WORD_CHAR_RE = /[\p{L}\p{N}]/u;

interface CacheRow {
  entries: SitemapEntry[];
  ts: number;
}
const sitemapCache = new Map<string, CacheRow>();

/**
 * Resolve the scheme+host origin to fetch the sitemap from. Prefers an explicit
 * blog URL, falls back to the bare domain. Returns null when neither is usable.
 */
export function resolveSiteOrigin(blogUrl?: string | null, domain?: string | null): string | null {
  const candidates = [blogUrl, domain].filter((v): v is string => typeof v === "string" && v.trim().length > 0);
  for (const raw of candidates) {
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw.trim()}`;
    try {
      const u = new URL(withScheme);
      if (u.hostname.includes(".")) return `${u.protocol}//${u.host}`;
    } catch {
      // try next candidate
    }
  }
  return null;
}

function normPath(pathname: string): string {
  const p = pathname.replace(/\/+$/, "");
  return (p || "/").toLowerCase();
}

function slugToPhrase(slug: string): string {
  let s = slug;
  try {
    s = decodeURIComponent(slug);
  } catch {
    /* keep raw on malformed escapes */
  }
  return s
    .replace(FILE_EXT_RE, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function phraseIsUsable(phrase: string, slug: string): boolean {
  if (!phrase || phrase.length < 4 || phrase.length > 80) return false;
  if (GENERIC_SLUGS.has(slug.toLowerCase())) return false;
  if (/^\d+$/.test(phrase.replace(/\s+/g, ""))) return false; // pure numeric id
  const words = phrase.split(" ").filter(Boolean);
  // Multi-word slugs are specific enough; single words must be long to avoid
  // linking generic terms.
  return words.length >= 2 || phrase.length >= 8;
}

async function fetchText(url: string, signal: AbortSignal): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SAMABot/1.0; +https://sama.successifier.com)" },
      signal,
      redirect: "follow",
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function extractLocs(xml: string): string[] {
  const out: string[] = [];
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) out.push(m[1].trim());
  return out;
}

async function discoverSitemapUrls(origin: string, signal: AbortSignal): Promise<string[]> {
  const urls = new Set<string>();
  // robots.txt may point at one or more sitemaps.
  const robots = await fetchText(`${origin}/robots.txt`, signal);
  if (robots) {
    for (const line of robots.split(/\r?\n/)) {
      const m = line.match(/^\s*sitemap:\s*(\S+)/i);
      if (m) urls.add(m[1].trim());
    }
  }
  // Common defaults as a fallback.
  urls.add(`${origin}/sitemap.xml`);
  urls.add(`${origin}/sitemap_index.xml`);
  return [...urls];
}

/**
 * Fetch and parse the sitemap for `origin`, returning content-page entries with
 * a derived anchor phrase. Cached per-origin for an hour. Returns [] on any
 * failure (no sitemap, network error, all generic slugs, etc.).
 */
export async function fetchSitemapEntries(origin: string): Promise<SitemapEntry[]> {
  const cached = sitemapCache.get(origin);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.entries;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SITEMAP_TIMEOUT_MS);
  let entries: SitemapEntry[] = [];
  try {
    const originHost = new URL(origin).host.toLowerCase();
    const sitemapUrls = await discoverSitemapUrls(origin, controller.signal);

    const pageUrls = new Set<string>();
    const childSitemaps: string[] = [];

    for (const sm of sitemapUrls) {
      const xml = await fetchText(sm, controller.signal);
      if (!xml) continue;
      const locs = extractLocs(xml);
      if (/<sitemapindex[\s>]/i.test(xml)) {
        for (const loc of locs) {
          if (childSitemaps.length >= MAX_CHILD_SITEMAPS) break;
          childSitemaps.push(loc);
        }
      } else {
        for (const loc of locs) pageUrls.add(loc);
      }
    }

    for (const child of childSitemaps.slice(0, MAX_CHILD_SITEMAPS)) {
      if (pageUrls.size >= MAX_ENTRIES * 4) break;
      const xml = await fetchText(child, controller.signal);
      if (!xml) continue;
      for (const loc of extractLocs(xml)) pageUrls.add(loc);
    }

    const seenPaths = new Set<string>();
    const seenPhrases = new Set<string>();
    for (const raw of pageUrls) {
      if (entries.length >= MAX_ENTRIES) break;
      let u: URL;
      try {
        u = new URL(raw);
      } catch {
        continue;
      }
      if (u.host.toLowerCase() !== originHost) continue;
      if (FILE_EXT_RE.test(u.pathname)) continue;
      const path = normPath(u.pathname);
      if (path === "/" || seenPaths.has(path)) continue;
      const segments = path.split("/").filter(Boolean);
      const slug = segments[segments.length - 1] || "";
      const phrase = slugToPhrase(slug);
      if (!phraseIsUsable(phrase, slug)) continue;
      if (seenPhrases.has(phrase)) continue; // first page wins a given phrase
      seenPaths.add(path);
      seenPhrases.add(phrase);
      entries.push({ url: `${u.protocol}//${u.host}${path}`, path, phrase });
    }
  } catch {
    entries = [];
  } finally {
    clearTimeout(timer);
  }

  sitemapCache.set(origin, { entries, ts: Date.now() });
  return entries;
}

// ---------------------------------------------------------------------------
// Link weaving
// ---------------------------------------------------------------------------

function isWordChar(ch: string | undefined): boolean {
  return !!ch && WORD_CHAR_RE.test(ch);
}

/** Char ranges in a line that must not be touched (links, images, code, tags). */
function protectedRanges(line: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  const patterns = [
    /!?\[[^\]]*\]\([^)]*\)/g, // md links & images
    /`[^`]*`/g, // inline code
    /<[^>]+>/g, // html tags
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) ranges.push([m.index, m.index + m[0].length]);
  }
  return ranges;
}

function inProtected(start: number, end: number, ranges: Array<[number, number]>): boolean {
  return ranges.some(([s, e]) => start < e && end > s);
}

/** Find the first whole-phrase, unprotected match of `phrase` in `line`. */
function findPhrase(line: string, phrase: string, ranges: Array<[number, number]>): { index: number; text: string } | null {
  const hay = line.toLowerCase();
  let from = 0;
  for (;;) {
    const idx = hay.indexOf(phrase, from);
    if (idx === -1) return null;
    const end = idx + phrase.length;
    const leftOk = !isWordChar(line[idx - 1]);
    const rightOk = !isWordChar(line[end]);
    if (leftOk && rightOk && !inProtected(idx, end, ranges)) {
      return { index: idx, text: line.slice(idx, end) };
    }
    from = idx + 1;
  }
}

const FENCE_RE = /^\s{0,3}(```|~~~)/;
const HEADING_RE = /^\s{0,3}#{1,6}\s/;
const TABLE_RE = /^\s*\|.*\|\s*$/;

function classifyExistingLinks(
  markdown: string,
  originHost: string | null,
): { count: number; paths: Set<string> } {
  const paths = new Set<string>();
  let count = 0;
  const re = /\[[^\]]+\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown)) !== null) {
    const href = m[1];
    let internal = false;
    let path: string | null = null;
    if (href.startsWith("/") && !href.startsWith("//")) {
      internal = true;
      try {
        path = normPath(new URL(href, "https://x.invalid").pathname);
      } catch {
        path = null;
      }
    } else if (/^https?:\/\//i.test(href) && originHost) {
      try {
        const u = new URL(href);
        if (u.host.toLowerCase() === originHost) {
          internal = true;
          path = normPath(u.pathname);
        }
      } catch {
        /* ignore */
      }
    }
    if (internal) {
      count += 1;
      if (path) paths.add(path);
    }
  }
  return { count, paths };
}

interface LinkerState {
  remaining: number;
  used: Set<string>; // entry paths already linked (or pre-existing internal links)
  sorted: SitemapEntry[];
}

function makeState(entries: SitemapEntry[], remaining: number, usedPaths: Set<string>, selfPath: string | null): LinkerState {
  const sorted = entries
    .filter((e) => e.path !== selfPath)
    .slice()
    .sort((a, b) => {
      const wa = a.phrase.split(" ").length;
      const wb = b.phrase.split(" ").length;
      if (wb !== wa) return wb - wa;
      return b.phrase.length - a.phrase.length;
    });
  return { remaining, used: new Set(usedPaths), sorted };
}

/** Weave links into one markdown string, mutating `state` (budget + used set). */
function weave(markdown: string, state: LinkerState): { markdown: string; added: number } {
  if (state.remaining <= 0) return { markdown, added: 0 };
  const lines = markdown.split("\n");
  let added = 0;
  let inFence = false;

  for (const entry of state.sorted) {
    if (state.remaining <= 0) break;
    if (state.used.has(entry.path)) continue;

    inFence = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (FENCE_RE.test(line)) {
        inFence = !inFence;
        continue;
      }
      if (inFence || !line.trim()) continue;
      if (HEADING_RE.test(line) || TABLE_RE.test(line)) continue;

      const ranges = protectedRanges(line);
      const hit = findPhrase(line, entry.phrase, ranges);
      if (!hit) continue;

      lines[i] =
        line.slice(0, hit.index) +
        `[${hit.text}](${entry.url})` +
        line.slice(hit.index + hit.text.length);
      state.used.add(entry.path);
      state.remaining -= 1;
      added += 1;
      break;
    }
  }

  return { markdown: lines.join("\n"), added };
}

export interface InjectOptions {
  maxLinks?: number;
  /** The article's own canonical URL or path, so we never self-link. */
  selfHref?: string | null;
  /** Host used to classify already-present links as internal. Defaults to entries' host. */
  originHost?: string | null;
}

function resolveOriginHost(entries: SitemapEntry[], opts: InjectOptions): string | null {
  if (opts.originHost) return opts.originHost.toLowerCase();
  if (entries[0]) {
    try {
      return new URL(entries[0].url).host.toLowerCase();
    } catch {
      return null;
    }
  }
  return null;
}

function resolveSelfPath(selfHref: string | null | undefined, originHost: string | null): string | null {
  if (!selfHref) return null;
  try {
    const u = selfHref.startsWith("/")
      ? new URL(selfHref, `https://${originHost || "x.invalid"}`)
      : new URL(selfHref);
    return normPath(u.pathname);
  } catch {
    return null;
  }
}

/** Single-string convenience wrapper used by the publish paths. */
export function injectInternalLinks(
  markdown: string,
  entries: SitemapEntry[],
  opts: InjectOptions = {},
): { markdown: string; linksAdded: number } {
  if (!markdown || entries.length === 0) return { markdown, linksAdded: 0 };
  const maxLinks = opts.maxLinks ?? DEFAULT_MAX_LINKS;
  const originHost = resolveOriginHost(entries, opts);
  const selfPath = resolveSelfPath(opts.selfHref, originHost);
  const existing = classifyExistingLinks(markdown, originHost);
  const remaining = maxLinks - existing.count;
  if (remaining <= 0) return { markdown, linksAdded: 0 };
  const state = makeState(entries, remaining, existing.paths, selfPath);
  const { markdown: out, added } = weave(markdown, state);
  return { markdown: out, linksAdded: added };
}

export interface ArticleFields {
  markdown?: string | null;
  intro_md?: string | null;
  sections?: Array<{ id?: string; heading?: string; body_md?: string }> | null;
}

/**
 * Weave links across a whole article (plain markdown OR structured intro +
 * sections) under one shared budget so the same page is never linked twice and
 * the total link count stays bounded across all fields.
 */
export function injectInternalLinksMulti(
  fields: ArticleFields,
  entries: SitemapEntry[],
  opts: InjectOptions = {},
): { fields: ArticleFields; linksAdded: number } {
  if (entries.length === 0) return { fields, linksAdded: 0 };
  const maxLinks = opts.maxLinks ?? DEFAULT_MAX_LINKS;
  const originHost = resolveOriginHost(entries, opts);
  const selfPath = resolveSelfPath(opts.selfHref, originHost);

  // Count existing internal links across every field so re-runs converge.
  const allText = [
    fields.markdown || "",
    fields.intro_md || "",
    ...(fields.sections || []).map((s) => s.body_md || ""),
  ].join("\n\n");
  const existing = classifyExistingLinks(allText, originHost);
  const remaining = maxLinks - existing.count;
  if (remaining <= 0) return { fields, linksAdded: 0 };

  const state = makeState(entries, remaining, existing.paths, selfPath);
  let total = 0;
  const out: ArticleFields = {};

  if (typeof fields.markdown === "string") {
    const r = weave(fields.markdown, state);
    out.markdown = r.markdown;
    total += r.added;
  }
  if (typeof fields.intro_md === "string") {
    const r = weave(fields.intro_md, state);
    out.intro_md = r.markdown;
    total += r.added;
  }
  if (Array.isArray(fields.sections)) {
    out.sections = fields.sections.map((s) => {
      if (typeof s.body_md !== "string") return s;
      const r = weave(s.body_md, state);
      total += r.added;
      return { ...s, body_md: r.markdown };
    });
  }

  return { fields: out, linksAdded: total };
}
