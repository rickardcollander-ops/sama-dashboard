import { NextRequest, NextResponse } from "next/server";
import {
  getCurrentUser,
  resolveSiteId,
} from "@/lib/integrations/store";
import {
  GitHubError,
  getGitHubConfig,
  listGitHubRepos,
} from "@/lib/integrations/github";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const siteId = resolveSiteId(req, user.id);
  const cfg = await getGitHubConfig(siteId);
  if (!cfg?.token) {
    return NextResponse.json({ error: "github not connected" }, { status: 400 });
  }

  try {
    const repos = await listGitHubRepos(cfg.token);
    return NextResponse.json({ repos });
  } catch (e) {
    const status = e instanceof GitHubError ? e.status : 500;
    const message = e instanceof Error ? e.message : "Could not list repos";
    return NextResponse.json({ error: message }, { status });
  }
}
