import { NextRequest, NextResponse, after } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { resolveSiteId } from "@/lib/integrations/site-context";
import {
  runOnboardingGeneration,
  type OnboardingFormInput,
  type TargetLocation,
} from "@/lib/onboarding/generate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// The four Claude calls plus the site scrape comfortably fit inside the
// 5-minute window. If a brand's article ends up at the long end of the
// word range we still leave ~60s of headroom.
export const maxDuration = 300;

function pickStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .map((s) => s.trim());
}

function normaliseDomain(raw: string): string {
  return raw.trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "").toLowerCase();
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // The SAMA backend rejects content/audit writes that don't carry the
  // user's Supabase bearer token (response is "Missing tenant context").
  // Pull it out here before scheduling the background job so we can
  // forward it on every upstream call — cookies aren't readable inside
  // after().
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const userAccessToken = session?.access_token ?? "";
  if (!userAccessToken) {
    return NextResponse.json(
      { error: "Missing Supabase session — please sign in again." },
      { status: 401 },
    );
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "Server is missing SUPABASE_SERVICE_ROLE_KEY" },
      { status: 500 },
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI service is not configured. Please contact support." },
      { status: 500 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const domain = normaliseDomain(String(body.domain ?? ""));
  if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
    return NextResponse.json(
      { error: "A valid domain is required" },
      { status: 400 },
    );
  }

  const rawLocations = Array.isArray(body.target_locations) ? body.target_locations : [];
  const target_locations: TargetLocation[] = rawLocations
    .filter((l): l is Record<string, unknown> => !!l && typeof l === "object")
    .map((l) => ({
      city: String(l.city ?? "").trim(),
      country: String(l.country ?? "").trim().toUpperCase().slice(0, 2),
      ...(l.region ? { region: String(l.region).trim() } : {}),
      ...(l.address ? { address: String(l.address).trim() } : {}),
      ...(l.postal_code ? { postal_code: String(l.postal_code).trim() } : {}),
      ...(l.phone ? { phone: String(l.phone).trim() } : {}),
      is_primary: l.is_primary === true,
    }))
    .filter((l) => l.city && l.country)
    .slice(0, 5);

  const input: OnboardingFormInput = {
    domain,
    brand_name: String(body.brand_name ?? "").trim(),
    brand_description: String(body.brand_description ?? "").trim(),
    target_audience: String(body.target_audience ?? "").trim(),
    content_language: String(body.content_language ?? "en").trim() || "en",
    competitors: pickStringArray(body.competitors).slice(0, 10),
    geo_queries: pickStringArray(body.geo_queries).slice(0, 10),
    brand_color: typeof body.brand_color === "string" ? body.brand_color.trim() : "",
    target_locations,
  };

  const siteId = resolveSiteId(req, user.id);

  // When an admin runs onboarding on behalf of a customer the siteId differs
  // from user.id. Look up the site's actual owner so rows land under the
  // correct account rather than the admin's.
  let ownerId = user.id;
  if (siteId !== user.id) {
    const { data: siteRow } = await admin
      .from("user_sites")
      .select("user_id")
      .eq("id", siteId)
      .maybeSingle();
    if (siteRow?.user_id) ownerId = siteRow.user_id;
  }

  const { data: job, error: jobError } = await admin
    .from("onboarding_jobs")
    .insert({
      user_id: ownerId,
      site_id: siteId,
      status: "queued",
      step: "queued",
      progress: 0,
      result: { input },
    })
    .select("id")
    .single();
  if (jobError || !job) {
    return NextResponse.json(
      { error: jobError?.message || "Could not create onboarding job" },
      { status: 500 },
    );
  }

  // Run the heavy work after the HTTP response is sent. after() keeps the
  // serverless function alive past the response — up to maxDuration above.
  after(async () => {
    await runOnboardingGeneration({
      admin,
      jobId: job.id,
      userId: ownerId,
      siteId,
      input,
      apiKey,
      userAccessToken,
    });
  });

  return NextResponse.json({ job_id: job.id });
}
