import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, loadSettings, saveSettings } from "@/lib/integrations/store";
import type { AnalysisRun } from "@/app/c/analysis/types";

export const runtime = "nodejs";

const MAX_SAVED_ANALYSES = 50;

/**
 * POST /api/analysis/runs/save
 *
 * Persists a completed AnalysisRun to user_settings.saved_analyses so the
 * user's analysis history survives even when the upstream sama-agent backend
 * is unreachable or rotates run IDs. We cap the list at MAX_SAVED_ANALYSES
 * (most recent first) to keep the settings JSON from growing unbounded.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const run = (await req.json().catch(() => null)) as AnalysisRun | null;
  if (!run || typeof run !== "object" || !run.id || run.status !== "completed") {
    return NextResponse.json({ error: "completed analysis run required" }, { status: 400 });
  }

  const settings = await loadSettings(user.id);
  const existing = Array.isArray(settings.saved_analyses)
    ? (settings.saved_analyses as AnalysisRun[])
    : [];

  const without = existing.filter((r) => r && r.id !== run.id);
  const next = [run, ...without].slice(0, MAX_SAVED_ANALYSES);

  await saveSettings(user.id, { ...settings, saved_analyses: next });

  return NextResponse.json({ saved: true, total: next.length });
}
