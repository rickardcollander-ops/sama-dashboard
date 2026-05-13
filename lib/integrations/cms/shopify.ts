import { CmsAdapter, PublishError, PublishInput, PublishResult } from "./types";

const DEFAULT_VERSION = "2024-10";

function normalizeShop(domain: string): string {
  let d = domain.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
  if (!d.includes(".")) d = `${d}.myshopify.com`;
  return d;
}

function buildHeaders(token: string): HeadersInit {
  return {
    "X-Shopify-Access-Token": token,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

export const shopifyAdapter: CmsAdapter = {
  kind: "shopify",

  async validate(cfg) {
    const shop = normalizeShop(cfg.shop_domain || "");
    const token = cfg.access_token?.trim();
    const blogId = cfg.blog_id?.trim();
    const version = cfg.api_version?.trim() || DEFAULT_VERSION;
    if (!shop || !token || !blogId) {
      return { ok: false, message: "shop_domain, access_token and blog_id are required" };
    }
    const res = await fetch(
      `https://${shop}/admin/api/${version}/blogs/${blogId}.json`,
      { headers: buildHeaders(token) },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, message: `Shopify ${res.status}: ${text.slice(0, 160)}` };
    }
    return { ok: true };
  },

  async publish(cfg, input: PublishInput): Promise<PublishResult> {
    const shop = normalizeShop(cfg.shop_domain || "");
    const token = cfg.access_token?.trim();
    const blogId = cfg.blog_id?.trim();
    const version = cfg.api_version?.trim() || DEFAULT_VERSION;
    if (!shop || !token || !blogId) {
      throw new PublishError("Shopify: shop_domain, access_token and blog_id are required", 400);
    }

    const html = input.body_html || "";
    const jsonldScript = input.jsonld
      ? `\n<script type="application/ld+json">${JSON.stringify(input.jsonld)}</script>`
      : "";

    const article: Record<string, unknown> = {
      title: input.title,
      body_html: html + jsonldScript,
      handle: input.slug,
      summary_html: input.excerpt,
      tags: (input.tags || []).join(", "),
      published: input.status !== "draft",
    };
    if (cfg.author) article.author = cfg.author;
    if (input.featured_image_url) {
      article.image = { src: input.featured_image_url };
    }

    const res = await fetch(
      `https://${shop}/admin/api/${version}/blogs/${blogId}/articles.json`,
      {
        method: "POST",
        headers: buildHeaders(token),
        body: JSON.stringify({ article }),
      },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new PublishError(`Shopify publish failed (${res.status})`, res.status, text);
    }
    const data = await res.json();
    const created = data.article;
    const handle = created?.handle || input.slug;
    return {
      external_id: created?.id ? String(created.id) : undefined,
      url: handle ? `https://${shop}/blogs/${created?.blog_id || blogId}/${handle}` : undefined,
      raw: { id: created?.id, handle: created?.handle, published_at: created?.published_at },
    };
  },
};
