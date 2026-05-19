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
  // The auth.admin SDK can throw on transient network issues; fall through with
  // an unenriched response rather than 500-ing the entire team page.
  const userIds = (members ?? [])
    .map((m) => m.user_id)
    .filter((v): v is string => !!v);

  const emailById = new Map<string, { email: string | null; last_sign_in_at: string | null }>();
  if (userIds.length > 0) {
    if (userIds.length <= 5) {
      for (const id of userIds) {
        try {
          const { data } = await admin.auth.admin.getUserById(id);
          if (data?.user) {
            emailById.set(id, {
              email: data.user.email ?? null,
              last_sign_in_at: data.user.last_sign_in_at ?? null,
            });
          }
        } catch {
          // single-user lookup failed — skip enrichment for this id
        }
      }
    } else {
      let page = 1;
      const perPage = 200;
      const wanted = new Set(userIds);
      while (wanted.size > 0 && page <= 50) {
        try {
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
        } catch {
          // listUsers threw — bail out of paging and return what we have
          break;
        }
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
  const guard = await requireAccount(req);
  if (!guard.ok) return guard.response;
  const { admin, accountId, user } = guard.ctx;

  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  // Every invited user gets full access — role distinction is currently
  // only used to flag the account owner (who cannot be removed).
  const role = "admin";

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
      try {
        const { data } = await admin.auth.admin.getUserById(row.user_id);
        if (data?.user?.email && data.user.email.toLowerCase() === email) {
          return NextResponse.json(
            { error: "User is already a member of this account" },
            { status: 409 },
          );
        }
      } catch {
        // skip this row's check rather than failing the entire invite
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
    try {
      const { data, error: listErr } = await admin.auth.admin.listUsers({ page, perPage });
      if (listErr) break;
      const found = data.users.find((u) => (u.email ?? "").toLowerCase() === email);
      if (found) {
        invitedUserId = found.id;
        break;
      }
      if (data.users.length < perPage) break;
      page += 1;
    } catch {
      break;
    }
  }

  if (!invitedUserId) {
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      req.headers.get("origin") ||
      new URL(req.url).origin;
    const redirectTo = `${appUrl}/c/auth/reset-password`;
    try {
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo,
        data: { invited_to_account_id: accountId },
      });
      if (error) {
        // Some Supabase deployments respond with an empty error body when the
        // user already exists. Retry by looking up the user directly so we can
        // add them as a member without forcing a re-invite.
        const msg = (error.message || "").toLowerCase();
        const looksLikeExists =
          msg.includes("already") ||
          msg.includes("registered") ||
          msg.includes("exists");
        if (looksLikeExists || !error.message || error.message === "{}") {
          let lookupPage = 1;
          while (lookupPage <= 50) {
            const { data: list, error: listErr } = await admin.auth.admin.listUsers({
              page: lookupPage,
              perPage,
            });
            if (listErr) break;
            const found = list.users.find(
              (u) => (u.email ?? "").toLowerCase() === email,
            );
            if (found) {
              invitedUserId = found.id;
              break;
            }
            if (list.users.length < perPage) break;
            lookupPage += 1;
          }
          if (!invitedUserId) {
            console.error("[members:invite] inviteUserByEmail failed", {
              email,
              accountId,
              error,
            });
            return NextResponse.json(
              {
                error:
                  error.message ||
                  "Could not invite user. Check Supabase email config or rate limits.",
              },
              { status: 400 },
            );
          }
        } else {
          console.error("[members:invite] inviteUserByEmail failed", {
            email,
            accountId,
            error,
          });
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
      } else {
        invitedUserId = data.user.id;
        inviteSent = true;
      }
    } catch (e) {
      console.error("[members:invite] inviteUserByEmail threw", {
        email,
        accountId,
        error: e,
      });
      const msg = e instanceof Error ? e.message : "Failed to send invitation";
      return NextResponse.json(
        { error: msg && msg !== "{}" ? msg : "Failed to send invitation" },
        { status: 500 },
      );
    }
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
