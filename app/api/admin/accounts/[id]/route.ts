import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { isAdminEmail } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { admin } = guard;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const patch: { email?: string; email_confirm?: boolean } = {};

  if (typeof body.email === "string") {
    const email = body.email.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }
    patch.email = email;
    // When admin changes the email we treat it as confirmed so the user can
    // sign in without going through Supabase's confirmation flow.
    patch.email_confirm = true;
  }

  if (body.confirm_email === true) {
    patch.email_confirm = true;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { data, error } = await admin.auth.admin.updateUserById(id, patch);
  if (error) {
    console.error("[admin:accounts:patch] updateUserById failed", { id, patch, error });
    return NextResponse.json(
      { error: error.message || "Could not update user" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    user: {
      id: data.user?.id ?? id,
      email: data.user?.email ?? null,
      email_confirmed_at: data.user?.email_confirmed_at ?? null,
    },
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { admin, userId } = guard;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  if (id === userId) {
    return NextResponse.json(
      { error: "Cannot delete your own admin account" },
      { status: 400 },
    );
  }

  // Belt-and-braces: also block deleting any account whose email is the
  // admin email, even if multiple users share it.
  const { data: target } = await admin.auth.admin.getUserById(id);
  if (target?.user && isAdminEmail(target.user.email)) {
    return NextResponse.json(
      { error: "Cannot delete the admin account" },
      { status: 400 },
    );
  }

  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
