import { NextRequest, NextResponse } from "next/server";
import { getAdapter } from "@/lib/integrations/cms";
import { CmsKind } from "@/lib/integrations/cms/types";
import { getCurrentUser } from "@/lib/integrations/store";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const kind = body.kind as CmsKind;
  const config = (body.config || {}) as Record<string, string>;
  try {
    const adapter = getAdapter(kind);
    if (!adapter.validate) {
      return NextResponse.json({ ok: true, message: "no validation available" });
    }
    const result = await adapter.validate(config);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "validation error" }, { status: 400 });
  }
}
