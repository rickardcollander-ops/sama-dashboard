import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

function describeError(err: unknown, fallback: string): string {
  if (!err) return fallback;
  if (typeof err === "string") {
    const t = err.trim();
    return !t || t === "{}" || t === "[]" || t === "[object Object]" ? fallback : t;
  }
  if (typeof err === "object") {
    const e = err as { message?: unknown; error_description?: unknown; code?: unknown };
    const c =
      (typeof e.message === "string" && e.message) ||
      (typeof e.error_description === "string" && e.error_description) ||
      (typeof e.code === "string" && e.code) ||
      "";
    const t = c.trim();
    return !t || t === "{}" || t === "[]" || t === "[object Object]" ? fallback : t;
  }
  return fallback;
}

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

  // Internal placeholders (foo@accounts.internal) can't receive mail. Tell
  // admin to use "Sätt nytt lösenord" instead of failing with a 500.
  if (target.user.email.toLowerCase().endsWith("@accounts.internal")) {
    return NextResponse.json(
      {
        error:
          "Det här kontot saknar riktig e-post (internt placeholder). Använd 'Sätt nytt lösenord' istället.",
      },
      { status: 400 },
    );
  }

  const origin = req.headers.get("origin") || new URL(req.url).origin;
  const redirectTo = `${origin}/c/auth/reset-password`;

  try {
    const { error } = await admin.auth.resetPasswordForEmail(target.user.email, {
      redirectTo,
    });
    if (error) {
      console.error("[admin:reset-password] resetPasswordForEmail failed", {
        userId: id,
        email: target.user.email,
        error,
      });
      return NextResponse.json(
        {
          error: describeError(
            error,
            "Supabase kunde inte skicka återställningsmailet (möjligen rate limit eller SMTP-fel). Använd 'Sätt nytt lösenord' istället.",
          ),
        },
        { status: 502 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[admin:reset-password] resetPasswordForEmail threw", {
      userId: id,
      error: e,
    });
    return NextResponse.json(
      {
        error: describeError(
          e,
          "Återställningsmailet kunde inte skickas. Använd 'Sätt nytt lösenord' istället.",
        ),
      },
      { status: 502 },
    );
  }
}
