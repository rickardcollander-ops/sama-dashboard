import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface TemplateVar {
  name: string;
  description?: string;
  sample?: string;
}

function isVariableList(v: unknown): v is TemplateVar[] {
  if (!Array.isArray(v)) return false;
  return v.every(
    (item) =>
      item !== null &&
      typeof item === "object" &&
      typeof (item as TemplateVar).name === "string" &&
      (item as TemplateVar).name.trim().length > 0,
  );
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ kind: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { admin } = guard;
  const { kind } = await params;

  const { data, error } = await admin
    .from("email_templates")
    .select(
      "kind, name, subject, body_markdown, variables, description, updated_at, updated_by",
    )
    .eq("kind", kind)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ template: data });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ kind: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { admin, email } = guard;
  const { kind } = await params;

  const body = (await req.json().catch(() => ({}))) as {
    subject?: string;
    body_markdown?: string;
    name?: string;
    description?: string;
    variables?: unknown;
  };

  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    updated_by: email,
  };
  if (typeof body.subject === "string") update.subject = body.subject;
  if (typeof body.body_markdown === "string") update.body_markdown = body.body_markdown;
  if (typeof body.name === "string" && body.name.trim()) update.name = body.name.trim();
  if (typeof body.description === "string") update.description = body.description;
  if (body.variables !== undefined) {
    if (!isVariableList(body.variables)) {
      return NextResponse.json(
        { error: "variables must be an array of { name, description?, sample? }" },
        { status: 400 },
      );
    }
    update.variables = body.variables;
  }

  const { data, error } = await admin
    .from("email_templates")
    .update(update)
    .eq("kind", kind)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ template: data });
}
