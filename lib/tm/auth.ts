/**
 * Access gate for the TM (telemarketing) operator portal routes.
 *
 * These routes read/write lead PII (names, phone numbers, emails) with the
 * service-role client and were previously open to the internet by design.
 * Operators now authenticate either with the shared operator token
 * (TM_PORTAL_TOKEN, sent as X-TM-Token — for the standalone operator UI) or
 * with a logged-in platform-admin session. Fail closed when neither works.
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { isAdminEmail } from "@/lib/admin";
import { timingSafeEqual } from "crypto";

function tokenMatches(presented: string, expected: string): boolean {
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function requireTmAccess(
  req: NextRequest,
): Promise<NextResponse | null> {
  const expected = (process.env.TM_PORTAL_TOKEN || "").trim();
  const presented = (req.headers.get("x-tm-token") || "").trim();
  if (expected && presented && tokenMatches(presented, expected)) {
    return null;
  }

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user && isAdminEmail(user.email ?? null)) {
      return null;
    }
  } catch {
    /* fall through to 401 */
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
