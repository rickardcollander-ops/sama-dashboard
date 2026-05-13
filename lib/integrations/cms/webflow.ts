import { CmsAdapter, PublishError, PublishInput, PublishResult } from "./types";

const API = "https://api.webflow.com/v2";

export const webflowAdapter: CmsAdapter = {
  kind: "webflow",

  async validate(cfg) {
    const token = cfg.api_token?.trim();
    const collection = cfg.collection_id?.trim();
    if (!token || !collection) {
      return { ok: false, message: "API token and collection_id are required" };
    }
    const res = await fetch(`${API}/collections/${collection}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { ok: false, message: `Webflow ${res.status}` };
    return { ok: true };
  },

  async publish(cfg, input: PublishInput): Promise<PublishResult> {
    const token = cfg.api_token?.trim();
    const collection = cfg.collection_id?.trim();
    if (!token || !collection) {
      throw new PublishError("Webflow: api_token and collection_id are required", 400);
    }

    const titleField = cfg.field_title || "name";
    const slugField = cfg.field_slug || "slug";
    const bodyField = cfg.field_body || "post-body";
    const excerptField = cfg.field_excerpt || "post-summary";
    const imageField = cfg.field_image || "main-image";

    const fieldData: Record<string, unknown> = {
      [titleField]: input.title,
      [slugField]: input.slug,
      [bodyField]: input.body_html || "",
    };
    if (input.excerpt) fieldData[excerptField] = input.excerpt;
    if (input.featured_image_url) fieldData[imageField] = input.featured_image_url;

    const res = await fetch(`${API}/collections/${collection}/items`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        isArchived: false,
        isDraft: input.status === "draft",
        fieldData,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new PublishError(`Webflow publish failed (${res.status})`, res.status, text);
    }
    const data = await res.json();
    const itemId = data.id;

    if (input.status !== "draft" && cfg.site_id) {
      await fetch(`${API}/collections/${collection}/items/${itemId}/publish`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ siteId: cfg.site_id }),
      }).catch(() => {});
    }
    return {
      external_id: itemId,
      url: cfg.site_url ? `${cfg.site_url.replace(/\/$/, "")}/blog/${input.slug}` : undefined,
      raw: { id: itemId },
    };
  },
};
