import { NextRequest, NextResponse } from "next/server";
import {
  getCurrentUser,
  resolveSiteId,
} from "@/lib/integrations/store";
import {
  GitHubConfig,
  GitHubError,
  getGitHubConfig,
  saveGitHubConfig,
  validateGitHubToken,
} from "@/lib/integrations/github";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const token = typeof body.github_token === "string" ? body.github_token.trim() : "";
  if (!token) {
    return NextResponse.json({ error: "github_token required" }, { status: 400 });
  }

  try {
    await validateGitHubToken(token);
  } catch (e) {
    const status = e instanceof GitHubError ? e.status : 500;
    const message = e instanceof Error ? e.message : "Token validation failed";
    return NextResponse.json({ error: message }, { status });
  }

  const siteId = resolveSiteId(req, user.id);
  const existing = (await getGitHubConfig(siteId)) || ({} as Partial<GitHubConfig>);

  const repoOwner = typeof body.repo_owner === "string" ? body.repo_owner.trim() : "";
  const repoName = typeof body.repo_name === "string" ? body.repo_name.trim() : "";
  const blogPath = typeof body.blog_path === "string" ? body.blog_path.trim() : "";
  const branch = typeof body.branch === "string" ? body.branch.trim() : "";

  const config: GitHubConfig = {
    token,
    repo_owner: repoOwner || existing.repo_owner,
    repo_name: repoName || existing.repo_name,
    blog_path: blogPath || existing.blog_path || "content/blog",
    branch: branch || existing.branch || "main",
    connected_at: existing.connected_at || new Date().toISOString(),
  };

  try {
    await saveGitHubConfig(siteId, config);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not save GitHub config";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    connected: !!(config.repo_owner && config.repo_name),
  });
}
