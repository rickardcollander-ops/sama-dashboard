import { NextRequest, NextResponse } from "next/server";
import { requireAccount } from "@/lib/account";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAccount(req, { minRole: "admin" });
  if (!guard.ok) return guard.response;
  const { admin, accountId } = guard.ctx;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const role = body.role === "admin" ? "admin" : body.role === "member" ? "member" : null;
  if (!role) {
    return NextResponse.json({ error: "role must be 'admin' or 'member'" }, { status: 400 });
  }

  // Fetch the row to make sure it belongs to the active account and isn't the owner.
  const { data: row } = await admin
    .from("account_members")
    .select("id, account_id, role, user_id")
    .eq("id", id)
    .maybeSingle();

  if (!row || row.account_id !== accountId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (row.role === "owner") {
    return NextResponse.json({ error: "Cannot change the owner's role" }, { status: 400 });
  }

  const { data: updated, error } = await admin
    .from("account_members")
    .update({ role })
    .eq("id", id)
    .select("id, account_id, user_id, invited_email, role, status, created_at, accepted_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ member: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAccount(req, { minRole: "admin" });
  if (!guard.ok) return guard.response;
  const { admin, accountId, user } = guard.ctx;

  const { id } = await params;

  const { data: row } = await admin
    .from("account_members")
    .select("id, account_id, role, user_id")
    .eq("id", id)
    .maybeSingle();

  if (!row || row.account_id !== accountId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (row.role === "owner") {
    return NextResponse.json({ error: "Cannot remove the account owner" }, { status: 400 });
  }
  if (row.user_id === user.id) {
    return NextResponse.json({ error: "Use leave to remove yourself" }, { status: 400 });
  }

  const { error } = await admin.from("account_members").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
