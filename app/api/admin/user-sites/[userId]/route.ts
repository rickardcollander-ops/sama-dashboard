import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { admin } = guard;

  const { userId } = await params;
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("user_sites")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ sites: data ?? [] });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { admin } = guard;

  const { userId } = await params;
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    site_name?: string;
    settings?: Record<string, unknown>;
  };

  const siteName = (body.site_name ?? "").trim();
  if (!siteName) {
    return NextResponse.json({ error: "site_name required" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("user_sites")
    .insert({ user_id: userId, site_name: siteName, settings: body.settings ?? {} })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ site: data });
}

// Save a site belonging to userId. Body: { id, site_name?, settings? }.
// Upserts by id so admins can save for users whose site row hasn't been
// created yet — mirrors the upsert the regular settings page uses for the
// user's own account. Refuses to clobber a row that already belongs to a
// different user_id.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { admin } = guard;

  const { userId } = await params;
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    id?: string;
    site_name?: string;
    settings?: Record<string, unknown>;
  };

  if (!body.id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const { data: existing, error: lookupError } = await admin
    .from("user_sites")
    .select("id, user_id")
    .eq("id", body.id)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json({ error: lookupError.message }, { status: 500 });
  }

  if (existing && existing.user_id !== userId) {
    return NextResponse.json(
      { error: "Site belongs to a different user" },
      { status: 403 },
    );
  }

  const row: Record<string, unknown> = {
    id: body.id,
    user_id: userId,
    updated_at: new Date().toISOString(),
  };
  if (typeof body.site_name === "string") row.site_name = body.site_name;
  if (body.settings && typeof body.settings === "object") row.settings = body.settings;

  const { data, error } = await admin
    .from("user_sites")
    .upsert(row, { onConflict: "id" })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ site: data });
}

// Delete a site belonging to userId. Query: ?id=<siteId>.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { admin } = guard;

  const { userId } = await params;
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const { error } = await admin
    .from("user_sites")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
