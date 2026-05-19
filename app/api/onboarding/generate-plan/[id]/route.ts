import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { isAdminEmail } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  // RLS limits visibility to the caller's own jobs — no extra .eq("user_id") guard needed.
  const { data, error } = await supabase
    .from("onboarding_jobs")
    .select("id, status, step, progress, error, result, created_at, updated_at")
    .eq("id", id)
    .single();

  if (!error && data) {
    return NextResponse.json(data);
  }

  // RLS blocks the row when the job was created under a different user_id than
  // the caller — this happens when an admin runs onboarding on behalf of a
  // customer (job.user_id = customer, caller = admin) or when a team member
  // runs onboarding on a shared site. Fall back to the service-role client
  // and verify access via site ownership before returning the row.
  const admin = getSupabaseAdmin();
  if (admin) {
    const { data: adminJob } = await admin
      .from("onboarding_jobs")
      .select("id, status, step, progress, error, result, created_at, updated_at, site_id, user_id")
      .eq("id", id)
      .maybeSingle();

    if (adminJob) {
      // Operator admins can see any job.
      const callerIsAdmin = isAdminEmail(user.email);
      if (callerIsAdmin) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { site_id: _s, user_id: _u, ...jobData } = adminJob;
        return NextResponse.json(jobData);
      }

      // Non-admin: allow if the caller's user_id owns the site the job targets,
      // or if they are a member of the relevant account. The quickest proxy is
      // checking user_sites directly with the service-role client so we can see
      // cross-account memberships without hitting RLS.
      const { data: siteRow } = await admin
        .from("user_sites")
        .select("user_id")
        .eq("id", adminJob.site_id)
        .maybeSingle();

      const siteOwnedByCaller = siteRow?.user_id === user.id;
      const { data: membership } = siteOwnedByCaller
        ? { data: null }
        : await admin
            .from("account_members")
            .select("role")
            .eq("account_id", adminJob.user_id)
            .eq("user_id", user.id)
            .eq("status", "active")
            .maybeSingle();

      if (siteOwnedByCaller || membership) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { site_id: _s, user_id: _u, ...jobData } = adminJob;
        return NextResponse.json(jobData);
      }
    }
  }

  return NextResponse.json({ error: "not_found" }, { status: 404 });
}
