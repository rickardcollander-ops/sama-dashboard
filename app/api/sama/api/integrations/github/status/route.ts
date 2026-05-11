import { NextRequest, NextResponse } from "next/server";
import {
  getCurrentUser,
  resolveSiteId,
} from "@/lib/integrations/store";
import {
  configToStatus,
  getGitHubConfig,
} from "@/lib/integrations/github";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const siteId = resolveSiteId(req, user.id);
  const cfg = await getGitHubConfig(siteId);
  return NextResponse.json(configToStatus(cfg));
}
