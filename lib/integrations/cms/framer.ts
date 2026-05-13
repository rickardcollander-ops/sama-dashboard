import { CmsAdapter, PublishError, PublishInput, PublishResult } from "./types";

const API = "https://api.framer.com/cms/v1";

export const framerAdapter: CmsAdapter = {
  kind: "framer",

  async validate(cfg) {
    const token = cfg.api_token?.trim();
    const collection = cfg.collection_id?.trim();
    if (!token || !collection) {
      return { ok: false, message: "api_token and collection_id are required" };
    }
    const res = await fetch(`${API}/collections/${collection}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, message: `Framer ${res.status}: ${text.slice(0, 160)}` };
    }
    return { ok: true };
  },

  async publish(cfg, input: PublishInput): Promise<PublishResult> {
    const token = cfg.api_token?.trim();
    const collection = cfg.collection_id?.trim();
    if (!token || !collection) {
      throw new PublishError("Framer: api_token and collection_id are required", 400);
    }

    const titleField = cfg.field_title || "title";
    const slugField = cfg.field_slug || "slug";
    const bodyField = cfg.field_body || "content";
    const excerptField = cfg.field_excerpt || "excerpt";
    const imageField = cfg.field_image || "image";

    const fields: Record<string, unknown> = {
      [titleField]: input.title,
      [slugField]: input.slug,
      [bodyField]: input.body_html || "",
    };
    if (input.excerpt) fields[excerptField] = input.excerpt;
    if (input.featured_image_url) fields[imageField] = input.featured_image_url;

    const res = await fetch(`${API}/collections/${collection}/items`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        draft: input.status === "draft",
        fields,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new PublishError(`Framer publish failed (${res.status})`, res.status, text);
    }
    const data = await res.json();
    const itemId = data?.id || data?.item?.id;
    return {
      external_id: itemId ? String(itemId) : undefined,
      url: cfg.site_url
        ? `${cfg.site_url.replace(/\/$/, "")}/blog/${input.slug}`
        : undefined,
      raw: { id: itemId },
    };
  },
};
