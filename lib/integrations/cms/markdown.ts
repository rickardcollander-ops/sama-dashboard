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

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
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
