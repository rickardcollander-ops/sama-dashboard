import { NextRequest, NextResponse } from "next/server";
import {
  getCurrentUser,
  getScheduled,
  removeScheduled,
  resolveSiteId,
  updateScheduled,
} from "@/lib/integrations/store";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const siteId = resolveSiteId(req, user.id);
  const scheduled = await getScheduled(siteId, user.id);
  return NextResponse.json({ scheduled });
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const siteId = resolveSiteId(req, user.id);
  const body = await req.json().catch(() => ({}));
  const id = body.id as string;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await updateScheduled(siteId, user.id, id, body.patch || {});
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const siteId = resolveSiteId(req, user.id);
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await removeScheduled(siteId, user.id, id);
  return NextResponse.json({ ok: true });
}
