import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { admin } = guard;

  const { id } = await params;
  const { data: target, error: lookupError } = await admin.auth.admin.getUserById(id);
  if (lookupError || !target?.user?.email) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const origin = req.headers.get("origin") || new URL(req.url).origin;
  const redirectTo = `${origin}/c/auth/reset-password`;

  const { error } = await admin.auth.resetPasswordForEmail(target.user.email, {
    redirectTo,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
