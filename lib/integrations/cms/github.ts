import { CmsAdapter, PublishError, PublishInput, PublishResult } from "./types";

const GITHUB_API = "https://api.github.com";
const UA = "sama-dashboard";

function ghHeaders(token: string): Record<string, string> {
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": UA,
    Authorization: `Bearer ${token}`,
  };
}

function toBase64(input: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(input, "utf-8").toString("base64");
  }
  const bytes = new TextEncoder().encode(input);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function frontMatter(input: PublishInput): string {
  const fm: string[] = ["---"];
  fm.push(`title: ${JSON.stringify(input.title)}`);
  if (input.slug) fm.push(`slug: ${JSON.stringify(input.slug)}`);
  fm.push(`date: ${new Date().toISOString()}`);
  if (input.excerpt) fm.push(`excerpt: ${JSON.stringify(input.excerpt)}`);
  if (input.meta_description) fm.push(`description: ${JSON.stringify(input.meta_description)}`);
  if (input.language) fm.push(`language: ${JSON.stringify(input.language)}`);
  if (input.featured_image_url) fm.push(`image: ${JSON.stringify(input.featured_image_url)}`);
  if (input.canonical_url) fm.push(`canonical_url: ${JSON.stringify(input.canonical_url)}`);
  if (input.tags?.length) {
    fm.push(`tags:`);
    for (const tag of input.tags) fm.push(`  - ${JSON.stringify(tag)}`);
  }
  fm.push(`status: ${JSON.stringify(input.status || "published")}`);
  fm.push("---");
  return fm.join("\n");
}

function cleanPath(path: string | undefined, fallback: string): string {
  const p = (path || fallback).trim().replace(/^\/+|\/+$/g, "");
  return p || fallback;
}

export const githubAdapter: CmsAdapter = {
  kind: "github",

  async validate(cfg) {
    const token = cfg.token?.trim();
    const repo_owner = cfg.repo_owner?.trim();
    const repo_name = cfg.repo_name?.trim();
    if (!token) return { ok: false, message: "GitHub token saknas" };
    if (!repo_owner || !repo_name) return { ok: false, message: "Repo (owner/name) krävs" };
    const res = await fetch(`${GITHUB_API}/repos/${repo_owner}/${repo_name}`, {
      headers: ghHeaders(token),
    });
    if (res.status === 401) return { ok: false, message: "GitHub-token är ogiltig eller utgången" };
    if (res.status === 404) return { ok: false, message: "Hittar inte repot — kontrollera owner/name och tokenens åtkomst" };
    if (!res.ok) return { ok: false, message: `GitHub svarade HTTP ${res.status}` };
    return { ok: true };
  },

  async publish(cfg, input: PublishInput): Promise<PublishResult> {
    const token = cfg.token?.trim();
    const repo_owner = cfg.repo_owner?.trim();
    const repo_name = cfg.repo_name?.trim();
    if (!token || !repo_owner || !repo_name) {
      throw new PublishError("GitHub: anslutning saknas — anslut under Integrationer", 400);
    }
    const branch = cfg.branch?.trim() || "main";
    const blogPath = cleanPath(cfg.blog_path, "content/blog");
    const slug = (input.slug || "post").replace(/[^a-z0-9-]+/gi, "-").toLowerCase().replace(/^-+|-+$/g, "") || "post";
    const filePath = `${blogPath}/${slug}.md`;

    const body = `${frontMatter(input)}\n\n${input.body_markdown || ""}\n`;
    const contentBase64 = toBase64(body);

    const contentUrl = `${GITHUB_API}/repos/${repo_owner}/${repo_name}/contents/${encodeURI(filePath)}`;

    let existingSha: string | undefined;
    const existing = await fetch(`${contentUrl}?ref=${encodeURIComponent(branch)}`, {
      headers: ghHeaders(token),
    });
    if (existing.status === 200) {
      const data = (await existing.json().catch(() => null)) as { sha?: string } | null;
      if (data?.sha) existingSha = data.sha;
    } else if (existing.status !== 404) {
      const text = await existing.text().catch(() => "");
      throw new PublishError(`GitHub kunde inte läsa filen (HTTP ${existing.status})`, existing.status, text);
    }

    const message = existingSha
      ? `chore(content): update ${slug}`
      : `chore(content): publish ${slug}`;

    const put = await fetch(contentUrl, {
      method: "PUT",
      headers: { ...ghHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        content: contentBase64,
        branch,
        sha: existingSha,
      }),
    });

    if (!put.ok) {
      const text = await put.text().catch(() => "");
      throw new PublishError(`GitHub-publicering misslyckades (HTTP ${put.status})`, put.status, text);
    }

    const data = (await put.json().catch(() => null)) as
      | { content?: { html_url?: string; sha?: string; path?: string }; commit?: { sha?: string; html_url?: string } }
      | null;

    return {
      url: data?.content?.html_url || data?.commit?.html_url,
      external_id: data?.content?.sha || data?.commit?.sha,
      raw: data,
    };
  },
};
