import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

// Charset chosen to avoid easily-confused glyphs (no 0/O/1/l/I) so the
// generated password is safe to dictate over the phone.
const PASSWORD_CHARS =
  "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*";

function generatePassword(length = 14): string {
  const buf = new Uint32Array(length);
  crypto.getRandomValues(buf);
  let out = "";
  for (const v of buf) {
    out += PASSWORD_CHARS[v % PASSWORD_CHARS.length];
  }
  return out;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { admin } = guard;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  let password: string;
  if (typeof body.password === "string" && body.password.length > 0) {
    if (body.password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 },
      );
    }
    password = body.password;
  } else {
    password = generatePassword(14);
  }

  const { data, error } = await admin.auth.admin.updateUserById(id, {
    password,
    email_confirm: true,
  });
  if (error) {
    console.error("[admin:set-password] updateUserById failed", { id, error });
    return NextResponse.json(
      { error: error.message || "Could not set password" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    password,
    email: data.user?.email ?? null,
  });
}
