import { NextRequest, NextResponse } from "next/server";
import { createHmac, randomBytes } from "crypto";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { userCanAccessSite } from "@/lib/site-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// All Google API scopes needed by supported services
const SCOPES = [
  "email",
  "profile",
  "https://www.googleapis.com/auth/webmasters.readonly",
  "https://www.googleapis.com/auth/analytics.readonly",
  "https://www.googleapis.com/auth/adwords",
].join(" ");

function signState(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const stateSecret = process.env.GOOGLE_OAUTH_STATE_SECRET;
  if (!clientId || !stateSecret) {
    return NextResponse.json({ error: "Google OAuth not configured" }, { status: 503 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams, origin } = new URL(req.url);
  const service = searchParams.get("service") ?? "search_console";
  const tenantId = searchParams.get("tenant_id") ?? "";

  // The callback binds the resulting Google tokens to this site id with the
  // service-role client (bypassing RLS), so ownership must be proven here —
  // otherwise any logged-in user could hijack another tenant's connection.
  if (tenantId && !(await userCanAccessSite(user, tenantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Same-origin only: the signed state is replayed verbatim as a redirect
  // target in the callback, so an absolute URL here is an open redirect.
  const requestedReturn = searchParams.get("return_url") ?? "";
  let returnUrl = `${origin}/c/settings/integrations`;
  if (requestedReturn) {
    try {
      const parsed = new URL(requestedReturn, origin);
      if (parsed.origin === origin) returnUrl = parsed.toString();
    } catch {
      /* keep default */
    }
  }

  const nonce = randomBytes(8).toString("hex");
  const stateData = JSON.stringify({ service, tenantId, returnUrl, nonce });
  const sig = signState(stateData, stateSecret);
  const state = Buffer.from(JSON.stringify({ data: stateData, sig })).toString("base64url");

  const redirectUri = `${origin}/api/auth/google/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  });

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}
