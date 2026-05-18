import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface StatePayload {
  service: string;
  tenantId: string;
  returnUrl: string;
  nonce: string;
}

function verifyState(stateB64: string, secret: string): StatePayload | null {
  try {
    const raw = Buffer.from(stateB64, "base64url").toString();
    const { data: stateData, sig } = JSON.parse(raw) as { data: string; sig: string };
    const expected = createHmac("sha256", secret).update(stateData).digest("hex");
    if (sig !== expected) return null;
    return JSON.parse(stateData) as StatePayload;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const stateParam = searchParams.get("state");
  const oauthError = searchParams.get("error");
  const fallback = `${origin}/c/settings/integrations`;

  const stateSecret = process.env.GOOGLE_OAUTH_STATE_SECRET;
  if (!stateSecret) {
    return NextResponse.redirect(`${fallback}?error=not_configured`);
  }

  if (oauthError || !code || !stateParam) {
    return NextResponse.redirect(`${fallback}?error=google_denied`);
  }

  const state = verifyState(stateParam, stateSecret);
  if (!state) {
    return NextResponse.redirect(`${fallback}?error=invalid_state`);
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/c/login`);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const redirectUri = `${origin}/api/auth/google/callback`;

  // Exchange code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${state.returnUrl}?error=token_exchange_failed`);
  }

  const { access_token, refresh_token, expires_in } = await tokenRes.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };

  // Get the Google account email
  const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  const userInfo = userInfoRes.ok
    ? (await userInfoRes.json() as { email?: string })
    : {};
  const accountEmail = userInfo.email ?? null;

  const tokenExpiry = new Date(Date.now() + (expires_in ?? 3600) * 1000).toISOString();

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.redirect(`${state.returnUrl}?error=db_error`);
  }

  // One OAuth grants all scopes — upsert a row for every supported service
  const SERVICES = ["search_console", "analytics", "ads"];
  const rows = SERVICES.map((service) => ({
    site_id: state.tenantId,
    service,
    access_token,
    refresh_token: refresh_token ?? null,
    token_expiry: tokenExpiry,
    account_email: accountEmail,
    connected_at: new Date().toISOString(),
  }));

  await admin
    .from("google_tokens")
    .upsert(rows, { onConflict: "site_id,service" });

  return NextResponse.redirect(state.returnUrl);
}
