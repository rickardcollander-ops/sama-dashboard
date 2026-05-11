import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { markdownToHtml } from "@/lib/integrations/cms/markdown";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function substitute(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name) =>
    name in vars ? vars[name] : `{{${name}}}`,
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ kind: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { admin } = guard;
  const { kind } = await params;

  const { data, error } = await admin
    .from("email_templates")
    .select("subject, body_markdown, variables")
    .eq("kind", kind)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    subject?: string;
    body_markdown?: string;
    variables?: Record<string, string>;
  };

  const subject = typeof body.subject === "string" ? body.subject : data.subject;
  const md = typeof body.body_markdown === "string" ? body.body_markdown : data.body_markdown;
  const overrides = body.variables ?? {};

  const vars: Record<string, string> = {};
  const defs = (data.variables as Array<{ name: string; sample?: string }>) || [];
  for (const v of defs) {
    if (typeof v?.name === "string") {
      vars[v.name] = typeof v.sample === "string" ? v.sample : "";
    }
  }
  for (const [k, val] of Object.entries(overrides)) {
    if (typeof val === "string") vars[k] = val;
  }

  const subjectRendered = substitute(subject, vars);
  const html = markdownToHtml(substitute(md, vars));

  return NextResponse.json({ subject: subjectRendered, html });
}
