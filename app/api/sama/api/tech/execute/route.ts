import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, resolveSiteId } from "@/lib/integrations/store";
import { getGitHubConfig } from "@/lib/integrations/github";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BACKEND =
  process.env.SAMA_API_URL ||
  process.env.NEXT_PUBLIC_SAMA_API_URL ||
  "https://web-production-5324a.up.railway.app";

const GITHUB_API = "https://api.github.com";
const UA = "sama-dashboard";

function ghFetch(path: string, token: string, init?: RequestInit): Promise<Response> {
  return fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": UA,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

function toBase64(s: string): string {
  return Buffer.from(s, "utf-8").toString("base64");
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50) || "tech-fix";
}

interface FileChange {
  path: string;
  content: string;
}

interface PreviewResult {
  title: string;
  description: string;
  files: FileChange[];
  summary: string;
}

async function callPreview(
  body: unknown,
  tenantId: string,
  accountId: string,
): Promise<PreviewResult> {
  const url = `${BACKEND.replace(/\/$/, "")}/api/tech/preview`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Tenant-ID": tenantId,
      "X-Sama-Site-Id": tenantId,
      "X-Sama-Account-Id": accountId,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Preview failed (HTTP ${res.status}): ${text}`);
  }
  return res.json() as Promise<PreviewResult>;
}

async function getBaseSha(
  token: string,
  owner: string,
  repo: string,
  branch: string,
): Promise<string> {
  const res = await ghFetch(
    `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`,
    token,
  );
  if (!res.ok) {
    throw new Error(`Could not get base branch SHA (HTTP ${res.status})`);
  }
  const data = (await res.json()) as { object?: { sha?: string } };
  const sha = data?.object?.sha;
  if (!sha) throw new Error("Missing SHA for base branch");
  return sha;
}

async function createBranch(
  token: string,
  owner: string,
  repo: string,
  newBranch: string,
  sha: string,
): Promise<void> {
  const res = await ghFetch(`/repos/${owner}/${repo}/git/refs`, token, {
    method: "POST",
    body: JSON.stringify({ ref: `refs/heads/${newBranch}`, sha }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Could not create branch (HTTP ${res.status}): ${text}`);
  }
}

async function getFileSha(
  token: string,
  owner: string,
  repo: string,
  path: string,
  branch: string,
): Promise<string | undefined> {
  const res = await ghFetch(
    `/repos/${owner}/${repo}/contents/${encodeURI(path)}?ref=${encodeURIComponent(branch)}`,
    token,
  );
  if (res.status === 404) return undefined;
  if (!res.ok) return undefined;
  const data = (await res.json().catch(() => null)) as { sha?: string } | null;
  return data?.sha;
}

async function putFile(
  token: string,
  owner: string,
  repo: string,
  path: string,
  content: string,
  branch: string,
  message: string,
  existingSha?: string,
): Promise<void> {
  const body: Record<string, string> = {
    message,
    content: toBase64(content),
    branch,
  };
  if (existingSha) body.sha = existingSha;
  const res = await ghFetch(`/repos/${owner}/${repo}/contents/${encodeURI(path)}`, token, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Could not write ${path} (HTTP ${res.status}): ${text}`);
  }
}

async function createPR(
  token: string,
  owner: string,
  repo: string,
  head: string,
  base: string,
  title: string,
  body: string,
): Promise<string> {
  const res = await ghFetch(`/repos/${owner}/${repo}/pulls`, token, {
    method: "POST",
    body: JSON.stringify({ title, body, head, base }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Could not create PR (HTTP ${res.status}): ${text}`);
  }
  const data = (await res.json()) as { html_url?: string };
  if (!data?.html_url) throw new Error("PR created but missing URL");
  return data.html_url;
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const siteId = resolveSiteId(req, user.id);
  const ghCfg = await getGitHubConfig(siteId);
  if (!ghCfg?.token || !ghCfg?.repo_owner || !ghCfg?.repo_name) {
    return NextResponse.json(
      { detail: "GitHub not connected. Connect in Settings first." },
      { status: 400 },
    );
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const { title, description } = body;
  if (!title || typeof title !== "string") {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const { token, repo_owner: owner, repo_name: repo } = ghCfg;
  const baseBranch = ghCfg.branch || "main";

  // Step 1: get AI-generated file content from the SAMA backend
  let preview: PreviewResult;
  try {
    preview = await callPreview(body, siteId, user.id);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not generate file content" },
      { status: 502 },
    );
  }

  if (!preview.files || preview.files.length === 0) {
    return NextResponse.json({ error: "No file changes generated" }, { status: 400 });
  }

  // Step 2: create the branch + commit files + open PR
  const branchSlug = `tech-fix/${slugify(title)}-${Date.now()}`;

  try {
    const baseSha = await getBaseSha(token, owner, repo, baseBranch);
    await createBranch(token, owner, repo, branchSlug, baseSha);

    for (const file of preview.files) {
      const existingSha = await getFileSha(token, owner, repo, file.path, branchSlug);
      await putFile(
        token,
        owner,
        repo,
        file.path,
        file.content,
        branchSlug,
        `tech: ${title}`,
        existingSha,
      );
    }

    const prBody = [
      description || preview.description || "",
      "",
      preview.summary ? `**Summary:** ${preview.summary}` : "",
      "",
      "_Created automatically by SAMA Tech Agent._",
    ]
      .join("\n")
      .trim();

    const prUrl = await createPR(token, owner, repo, branchSlug, baseBranch, title, prBody);

    return NextResponse.json({
      pr_url: prUrl,
      branch: branchSlug,
      files_changed: preview.files.map((f) => f.path),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not create PR" },
      { status: 502 },
    );
  }
}
