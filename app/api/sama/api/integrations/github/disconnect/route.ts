import { NextRequest, NextResponse } from "next/server";
import {
  getCurrentUser,
  resolveSiteId,
} from "@/lib/integrations/store";
import { clearGitHubConfig } from "@/lib/integrations/github";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const siteId = resolveSiteId(req, user.id);
  try {
    await clearGitHubConfig(siteId);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not disconnect";
    return NextResponse.json({ error: message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
