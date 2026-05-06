import { NextRequest, NextResponse } from "next/server";
import { requireAccount } from "@/lib/account";

export const dynamic = "force-dynamic";

interface MemberRow {
  id: string;
  account_id: string;
  user_id: string | null;
  invited_email: string | null;
  role: "owner" | "admin" | "member";
  status: "pending" | "active";
  created_at: string;
  accepted_at: string | null;
  email: string | null;
  last_sign_in_at: string | null;
}

export async function GET(req: NextRequest) {
  const guard = await requireAccount(req);
  if (!guard.ok) return guard.response;
  const { admin, accountId } = guard.ctx;

  const { data: members, error } = await admin
    .from("account_members")
    .select("id, account_id, user_id, invited_email, role, status, created_at, accepted_at")
    .eq("account_id", accountId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Enrich with auth.users data so the UI can show real emails for active members.
  const userIds = (members ?? [])
    .map((m) => m.user_id)
    .filter((v): v is string => !!v);

  const emailById = new Map<string, { email: string | null; last_sign_in_at: string | null }>();
  if (userIds.length > 0) {
    // Supabase admin SDK has no batch lookup, but listUsers returns enough for
    // typical team sizes. For larger teams we do per-id lookups.
    if (userIds.length <= 5) {
      for (const id of userIds) {
        const { data } = await admin.auth.admin.getUserById(id);
        if (data?.user) {
          emailById.set(id, {
            email: data.user.email ?? null,
            last_sign_in_at: data.user.last_sign_in_at ?? null,
          });
        }
      }
    } else {
      let page = 1;
      const perPage = 200;
      const wanted = new Set(userIds);
      while (wanted.size > 0 && page <= 50) {
        const { data, error: listErr } = await admin.auth.admin.listUsers({ page, perPage });
        if (listErr) break;
        for (const u of data.users) {
          if (wanted.has(u.id)) {
            emailById.set(u.id, {
              email: u.email ?? null,
              last_sign_in_at: u.last_sign_in_at ?? null,
            });
            wanted.delete(u.id);
          }
        }
        if (data.users.length < perPage) break;
        page += 1;
      }
    }
  }

  const enriched: MemberRow[] = (members ?? []).map((m) => {
    const profile = m.user_id ? emailById.get(m.user_id) : undefined;
    return {
      id: m.id,
      account_id: m.account_id,
      user_id: m.user_id,
      invited_email: m.invited_email,
      role: m.role,
      status: m.status,
      created_at: m.created_at,
      accepted_at: m.accepted_at,
      email: profile?.email ?? m.invited_email,
      last_sign_in_at: profile?.last_sign_in_at ?? null,
    };
  });

  return NextResponse.json({ members: enriched, role: guard.ctx.role });
}

export async function POST(req: NextRequest) {
  const guard = await requireAccount(req, { minRole: "admin" });
  if (!guard.ok) return guard.response;
  const { admin, accountId, user } = guard.ctx;

  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const role = body.role === "admin" ? "admin" : "member";

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  // Already a member?
  const { data: existingByUser } = await admin
    .from("account_members")
    .select("id, user_id, status")
    .eq("account_id", accountId);
  if (existingByUser) {
    for (const row of existingByUser) {
      if (!row.user_id) continue;
      const { data } = await admin.auth.admin.getUserById(row.user_id);
      if (data?.user?.email && data.user.email.toLowerCase() === email) {
        return NextResponse.json(
          { error: "User is already a member of this account" },
          { status: 409 },
        );
      }
    }
  }

  // Already invited?
  const { data: existingInvite } = await admin
    .from("account_members")
    .select("id, status")
    .eq("account_id", accountId)
    .ilike("invited_email", email)
    .eq("status", "pending")
    .maybeSingle();
  if (existingInvite) {
    return NextResponse.json(
      { error: "An invitation for that email is already pending" },
      { status: 409 },
    );
  }

  // Look up or invite the auth user.
  let invitedUserId: string | null = null;
  let inviteSent = false;

  // Try to find an existing auth user with this email by paging.
  let page = 1;
  const perPage = 200;
  while (page <= 50) {
    const { data, error: listErr } = await admin.auth.admin.listUsers({ page, perPage });
    if (listErr) break;
    const found = data.users.find((u) => (u.email ?? "").toLowerCase() === email);
    if (found) {
      invitedUserId = found.id;
      break;
    }
    if (data.users.length < perPage) break;
    page += 1;
  }

  if (!invitedUserId) {
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      req.headers.get("origin") ||
      new URL(req.url).origin;
    const redirectTo = `${appUrl}/c/auth/reset-password`;
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: { invited_to_account_id: accountId },
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    invitedUserId = data.user.id;
    inviteSent = true;
  }

  // Insert the member row. If the auth user already existed we mark them
  // active immediately (they can already log in); otherwise they become
  // active when /api/account/accept-invite confirms their identity.
  const isExisting = !inviteSent;
  const { data: inserted, error: insertErr } = await admin
    .from("account_members")
    .insert({
      account_id: accountId,
      user_id: invitedUserId,
      invited_email: email,
      role,
      status: isExisting ? "active" : "pending",
      invited_by: user.id,
      accepted_at: isExisting ? new Date().toISOString() : null,
    })
    .select("id, account_id, user_id, invited_email, role, status, created_at, accepted_at")
    .single();

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ member: inserted, invited: inviteSent });
}
