import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { isAdminEmail } from "@/lib/admin";

export const dynamic = "force-dynamic";

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
