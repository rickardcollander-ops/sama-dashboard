import { NextRequest, NextResponse } from "next/server";
import { createHmac, randomBytes } from "crypto";
import { createSupabaseServerClient } from "@/lib/supabase-server";

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
  const returnUrl = searchParams.get("return_url") ?? `${origin}/c/settings/integrations`;

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
