import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Default page size keeps the table fast even when the log is large.
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { admin } = guard;

  const url = new URL(req.url);
  const kind = url.searchParams.get("kind");
  const status = url.searchParams.get("status");
  const userId = url.searchParams.get("user_id");
  const recipient = url.searchParams.get("recipient");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const includeTest = url.searchParams.get("include_test") !== "0";
  const limit = Math.min(
    Math.max(parseInt(url.searchParams.get("limit") || `${DEFAULT_LIMIT}`, 10) || DEFAULT_LIMIT, 1),
    MAX_LIMIT,
  );
  const offset = Math.max(parseInt(url.searchParams.get("offset") || "0", 10) || 0, 0);

  let query = admin
    .from("email_send_log")
    .select(
      "id, user_id, recipient, kind, subject, status, message_id, error, stats, test, created_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (kind) query = query.eq("kind", kind);
  if (status) query = query.eq("status", status);
  if (userId) query = query.eq("user_id", userId);
  if (recipient) query = query.ilike("recipient", `%${recipient}%`);
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);
  if (!includeTest) query = query.eq("test", false);

  const { data, count, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    rows: data ?? [],
    total: count ?? 0,
    limit,
    offset,
  });
}
