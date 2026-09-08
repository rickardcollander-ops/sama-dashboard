import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeSlug)
  .use(rehypeStringify, { allowDangerousHtml: true })
  .freeze();

// LLM-generated articles append Pandoc-style {#id} suffixes to headings.
// Strip them so they don't render as literal text — rehype-slug regenerates
// IDs from the heading text, which matches what the LLM was emitting anyway.
const stripHeadingIds = (md: string): string =>
  md.replace(/^(#{1,6}\s+[^\n]*?)\s*\{#[\w-]+\}\s*$/gm, "$1");

export function markdownToHtml(md: string): string {
  if (!md) return "";
  return String(processor.processSync(stripHeadingIds(md)));
}

// Letters with no combining-mark decomposition, so NFKD alone would delete
// them. Kept in step with `_SLUG_TRANSLITERATIONS` in the backend's
// shared/language.py so a slug computed here matches the one the article
// writer produced — otherwise the canonical URL and the published URL diverge.
const SLUG_TRANSLITERATIONS: Record<string, string> = {
  "ß": "ss",
  "æ": "ae",
  "ø": "o",
  "œ": "oe",
  "đ": "d",
  "ð": "d",
  "þ": "th",
  "ł": "l",
};

export function slugify(s: string): string {
  let text = s.toLowerCase();
  for (const [from, to] of Object.entries(SLUG_TRANSLITERATIONS)) {
    text = text.split(from).join(to);
  }
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/, "");
}

/**
 * Serializes a JSON-LD object into a `<script type="application/ld+json">`
 * tag safe to interpolate into HTML/CMS payloads. Escaping `<` as `<`
 * prevents a malicious jsonld value (e.g. containing `</script><script>...`)
 * from breaking out of the script tag and injecting markup — the classic
 * stored-XSS vector for JSON embedded in HTML.
 */
export function safeJsonLdScript(jsonld: unknown): string {
  const json = JSON.stringify(jsonld).replace(/</g, "\\u003c");
  return `<script type="application/ld+json">${json}</script>`;
}

export function excerptFromMarkdown(md: string, limit = 160): string {
  const text = md
    .replace(/```[\s\S]*?```/g, "")
    .replace(/[#>*_`-]/g, " ")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= limit) return text;
  return text.slice(0, limit - 1).replace(/\s\S*$/, "") + "…";
}
