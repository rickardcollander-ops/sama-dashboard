/**
 * Live health of every site's publish destination.
 *
 * `/c/settings/sites` renders `evaluateSiteReadiness`, which can only see what
 * is configured. A revoked GitHub token stays configured, so the page happily
 * reported "Publiceringsmål: GitHub — owner/repo" while every publish — manual
 * and cron alike — was failing with HTTP 401. This route closes that gap by
 * asking each CMS whether the credentials still work.
 *
 * Scoped by RLS: `user_sites` only returns the sites this user owns or is a
 * member of, so the loop can never probe someone else's connection.
 */
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/integrations/store";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { resolveBridgeDestination } from "@/lib/integrations/auto-publish-bridge";
import { checkDestinationHealth, type DestinationHealth } from "@/lib/integrations/destination-health";
import { mapPool } from "@/lib/integrations/concurrency";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** One outbound call per site; a handful at a time is plenty for a settings page. */
const CONCURRENCY = 4;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("user_sites").select("id, settings");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const sites = (data ?? []) as { id: string; settings: Record<string, unknown> | null }[];
  const health: Record<string, DestinationHealth> = {};

  await mapPool(sites, CONCURRENCY, async (site) => {
    // The same destination the publish bridge would ship to, so the verdict
    // describes what actually happens at 06:00 rather than some other row.
    const dest = resolveBridgeDestination(site.settings || {});
    if (!dest) return;
    health[site.id] = await checkDestinationHealth(dest);
  });

  return NextResponse.json({ health });
}
