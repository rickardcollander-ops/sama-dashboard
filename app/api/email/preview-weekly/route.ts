import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SAMA_API_URL =
  process.env.SAMA_API_URL ||
  process.env.NEXT_PUBLIC_SAMA_API_URL ||
  "https://web-production-5324a.up.railway.app";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const upstream = await fetch(
    `${SAMA_API_URL}/api/email/weekly/preview/${encodeURIComponent(user.id)}`,
    { headers: { Accept: "text/html" } }
  );

  if (!upstream.ok) {
    return NextResponse.json(
      { error: "upstream_failed", status: upstream.status },
      { status: upstream.status }
    );
  }

  const html = await upstream.text();
  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
