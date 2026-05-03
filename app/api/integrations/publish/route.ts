import { NextRequest, NextResponse } from "next/server";
import {
  appendScheduled,
  getCurrentUser,
  getDestinations,
  loadSettings,
} from "@/lib/integrations/store";
import { getAdapter } from "@/lib/integrations/cms";
import { excerptFromMarkdown, markdownToHtml, slugify } from "@/lib/integrations/cms/markdown";
import { buildArticleJsonLd } from "@/lib/integrations/jsonld";
import { PublishError, PublishInput } from "@/lib/integrations/cms/types";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const destinationId = body.destination_id as string;
  const pieceId = body.piece_id as string | undefined;
  const scheduledAt = body.scheduled_at as string | undefined;
  if (!destinationId) {
    return NextResponse.json({ error: "destination_id required" }, { status: 400 });
  }

  const destinations = await getDestinations(user.id);
  const dest = destinations.find((d) => d.id === destinationId);
  if (!dest) return NextResponse.json({ error: "destination not found" }, { status: 404 });

  const settings = await loadSettings(user.id);
  const title = (body.title || "").toString().trim();
  const bodyMd = (body.body_markdown || body.body || "").toString();
  if (!title || !bodyMd) {
    return NextResponse.json({ error: "title and body_markdown required" }, { status: 400 });
  }

  const settingStr = (k: string) =>
    typeof settings[k] === "string" ? (settings[k] as string) : undefined;

  const slug = body.slug || slugify(title);
  const excerpt = body.excerpt || excerptFromMarkdown(bodyMd);
  const html = markdownToHtml(bodyMd);
  const language = body.language || settingStr("content_language") || "en";
  const tags: string[] = Array.isArray(body.tags) ? body.tags : [];
  const featuredImage = body.featured_image_url as string | undefined;
  const status: "draft" | "published" = body.status === "draft" ? "draft" : "published";

  const blogUrl = settingStr("blog_url");
  const domain = settingStr("domain");
  const canonicalBase = blogUrl || (domain ? `https://${domain}` : "");
  const canonicalUrl = canonicalBase
    ? `${canonicalBase.replace(/\/$/, "")}/${slug}`
    : undefined;

  const brandName = settingStr("brand_name");
  const jsonld = buildArticleJsonLd({
    title,
    description: excerpt,
    url: canonicalUrl,
    image: featuredImage,
    language,
    keywords: tags,
    author_name: brandName,
    publisher_name: brandName,
    publisher_logo: settingStr("publisher_logo_url"),
  });

  if (scheduledAt) {
    const ts = Date.parse(scheduledAt);
    if (Number.isNaN(ts) || ts < Date.now() - 60_000) {
      return NextResponse.json({ error: "scheduled_at must be a future ISO timestamp" }, { status: 400 });
    }
    const scheduled = await appendScheduled(user.id, {
      piece_id: pieceId || `local-${Date.now()}`,
      destination_id: destinationId,
      scheduled_at: new Date(ts).toISOString(),
      payload: {
        title,
        slug,
        body_markdown: bodyMd,
        excerpt,
        meta_description: body.meta_description || excerpt,
        tags,
        language,
        featured_image_url: featuredImage,
        canonical_url: canonicalUrl,
        status,
      },
    });
    return NextResponse.json({ scheduled });
  }

  const adapter = getAdapter(dest.kind);
  const input: PublishInput = {
    title,
    slug,
    body_markdown: bodyMd,
    body_html: html,
    excerpt,
    meta_description: body.meta_description || excerpt,
    tags,
    language,
    featured_image_url: featuredImage,
    canonical_url: canonicalUrl,
    jsonld,
    status,
  };

  try {
    const result = await adapter.publish(dest.config, input);
    return NextResponse.json({ result, destination: { id: dest.id, kind: dest.kind, name: dest.name } });
  } catch (e) {
    const status = e instanceof PublishError ? e.status : 500;
    const message = e instanceof Error ? e.message : "Publish failed";
    const detail = e instanceof PublishError ? e.detail : undefined;
    return NextResponse.json({ error: message, detail }, { status });
  }
}
