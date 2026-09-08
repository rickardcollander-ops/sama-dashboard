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

/**
 * GitHub's own explanation for a refusal, and the raw body behind it.
 *
 * Every 4xx from the REST API carries a JSON `message`, and for a 403 it is the
 * only thing that distinguishes the four fixes: a token without write access
 * ("Resource not accessible by personal access token"), an org that requires
 * SSO authorization, an archived repository, or a spent rate limit. Throwing
 * only "HTTP 403" forces the user into DevTools to find that out.
 */
async function githubRefusal(res: Response): Promise<{ reason?: string; detail: string }> {
  const detail = await res.text().catch(() => "");
  try {
    const parsed = JSON.parse(detail) as { message?: string };
    const message = typeof parsed?.message === "string" ? parsed.message.trim() : "";
    // Bounded: this is rendered in the publish dialog, not logged.
    return { reason: message ? message.slice(0, 300) : undefined, detail };
  } catch {
    return { detail };
  }
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
    if (!token) return { ok: false, message: "GitHub token is required" };
    if (!repo_owner || !repo_name) return { ok: false, message: "Repo (owner/name) is required" };
    const res = await fetch(`${GITHUB_API}/repos/${repo_owner}/${repo_name}`, {
      headers: ghHeaders(token),
    });
    if (res.status === 401) return { ok: false, message: "GitHub token is invalid or expired" };
    if (res.status === 404) return { ok: false, message: "Repository not found — check owner/name and token permissions" };
    if (!res.ok) {
      const { reason } = await githubRefusal(res);
      return { ok: false, message: reason ? `GitHub: ${reason}` : `GitHub responded with HTTP ${res.status}` };
    }
    // Publishing writes a file, so read access is not enough — and a token
    // that can read a repo and not write it fails at publish time with a 403,
    // long after anyone was looking at this screen. Two read-only signals catch
    // most of that; both are shaped to never reject a token that would work.
    const repo = (await res.json().catch(() => null)) as
      | { private?: boolean; permissions?: { push?: boolean } }
      | null;

    // 1. The account's access to the repo. Catches a read-only collaborator.
    //    It cannot see a fine-grained token's own Contents scope, so it can say
    //    "ok" about a token that still cannot write — never the reverse.
    if (repo?.permissions && repo.permissions.push === false) {
      return {
        ok: false,
        message: "The token's account has read-only access to this repository — publishing needs write access",
      };
    }

    // 2. A classic token's scopes, which GitHub returns in this header (a
    //    fine-grained token has none, so an absent or empty header means
    //    "cannot tell" and is left alone rather than guessed at).
    const scopeHeader = res.headers.get("x-oauth-scopes");
    if (scopeHeader && scopeHeader.trim()) {
      const scopes = scopeHeader.split(",").map((x) => x.trim()).filter(Boolean);
      const canWrite = scopes.includes("repo") || (repo?.private === false && scopes.includes("public_repo"));
      if (!canWrite) {
        const needed = repo?.private === false ? '"repo" or "public_repo"' : '"repo"';
        return {
          ok: false,
          message: `This token's scopes (${scopes.join(", ")}) do not include write access — it needs ${needed}`,
        };
      }
    }

    return { ok: true };
  },

  async publish(cfg, input: PublishInput): Promise<PublishResult> {
    const token = cfg.token?.trim();
    const repo_owner = cfg.repo_owner?.trim();
    const repo_name = cfg.repo_name?.trim();
    if (!token || !repo_owner || !repo_name) {
      throw new PublishError("GitHub: connection missing — connect under Integrations", 400);
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
      const { reason, detail } = await githubRefusal(existing);
      throw new PublishError(
        `GitHub could not read ${filePath} (HTTP ${existing.status})`,
        existing.status,
        detail,
        reason,
      );
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
      const { reason, detail } = await githubRefusal(put);
      // Name the write explicitly: a 403 here means the token could *read* the
      // repo a moment ago and was refused the commit, which points at write
      // permission rather than at the connection as a whole.
      throw new PublishError(
        `GitHub refused the commit to ${branch}:${filePath} (HTTP ${put.status})`,
        put.status,
        detail,
        reason,
      );
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
