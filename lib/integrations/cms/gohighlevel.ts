import { CmsAdapter, PublishError, PublishInput, PublishResult } from "./types";
import { safeJsonLdScript } from "./markdown";

const API = "https://services.leadconnectorhq.com";
const DEFAULT_VERSION = "2021-07-28";

function buildHeaders(cfg: Record<string, string>): HeadersInit {
  return {
    Authorization: `Bearer ${cfg.api_token?.trim() || ""}`,
    Version: cfg.version?.trim() || DEFAULT_VERSION,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

export const gohighlevelAdapter: CmsAdapter = {
  kind: "gohighlevel",

  async validate(cfg) {
    const token = cfg.api_token?.trim();
    const locationId = cfg.location_id?.trim();
    const blogId = cfg.blog_id?.trim();
    if (!token || !locationId || !blogId) {
      return { ok: false, message: "api_token, location_id and blog_id are required" };
    }
    const res = await fetch(
      `${API}/blogs/site/all?locationId=${encodeURIComponent(locationId)}&limit=1&offset=0`,
      { headers: buildHeaders(cfg) },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, message: `GHL ${res.status}: ${text.slice(0, 160)}` };
    }
    return { ok: true };
  },

  async publish(cfg, input: PublishInput): Promise<PublishResult> {
    const token = cfg.api_token?.trim();
    const locationId = cfg.location_id?.trim();
    const blogId = cfg.blog_id?.trim();
    if (!token || !locationId || !blogId) {
      throw new PublishError("GHL: api_token, location_id and blog_id are required", 400);
    }

    const html = input.body_html || "";
    const jsonldScript = input.jsonld ? `\n${safeJsonLdScript(input.jsonld)}` : "";

    const payload: Record<string, unknown> = {
      title: input.title,
      locationId,
      blogId,
      imageUrl: input.featured_image_url || "",
      description: input.excerpt || input.meta_description || "",
      rawHTML: html + jsonldScript,
      status: input.status === "draft" ? "DRAFT" : "PUBLISHED",
      urlSlug: input.slug,
      canonicalLink: input.canonical_url || "",
      publishedAt: new Date().toISOString(),
    };
    if (cfg.author_id) payload.author = cfg.author_id;
    if (input.tags?.length) payload.tags = input.tags;
    if (input.meta_description) payload.metaDescription = input.meta_description;

    const res = await fetch(`${API}/blogs/posts`, {
      method: "POST",
      headers: buildHeaders(cfg),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new PublishError(`GHL publish failed (${res.status})`, res.status, text);
    }
    const data = await res.json();
    const post = data?.data || data?.post || data;
    return {
      external_id: post?._id || post?.id ? String(post._id || post.id) : undefined,
      url: post?.url || undefined,
      raw: post,
    };
  },
};
