import { CmsAdapter, PublishError, PublishInput, PublishResult } from "./types";

const API = "https://api.bigcommerce.com";

function buildHeaders(cfg: Record<string, string>): HeadersInit {
  return {
    "X-Auth-Token": cfg.access_token?.trim() || "",
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

function storePath(cfg: Record<string, string>, version: "v2" | "v3", path: string): string {
  const hash = cfg.store_hash?.trim();
  return `${API}/stores/${hash}/${version}${path}`;
}

export const bigcommerceAdapter: CmsAdapter = {
  kind: "bigcommerce",

  async validate(cfg) {
    const hash = cfg.store_hash?.trim();
    const token = cfg.access_token?.trim();
    if (!hash || !token) {
      return { ok: false, message: "store_hash and access_token are required" };
    }
    const res = await fetch(storePath(cfg, "v2", "/store"), {
      headers: buildHeaders(cfg),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, message: `BigCommerce ${res.status}: ${text.slice(0, 160)}` };
    }
    return { ok: true };
  },

  async publish(cfg, input: PublishInput): Promise<PublishResult> {
    const hash = cfg.store_hash?.trim();
    const token = cfg.access_token?.trim();
    if (!hash || !token) {
      throw new PublishError("BigCommerce: store_hash and access_token are required", 400);
    }

    const html = input.body_html || "";
    const jsonldScript = input.jsonld
      ? `\n<script type="application/ld+json">${JSON.stringify(input.jsonld)}</script>`
      : "";

    const payload: Record<string, unknown> = {
      title: input.title,
      url: input.slug ? `/${input.slug}/` : undefined,
      body: html + jsonldScript,
      summary: input.excerpt,
      meta_description: input.meta_description || input.excerpt,
      tags: input.tags || [],
      is_published: input.status !== "draft",
    };
    if (cfg.author) payload.author = cfg.author;
    if (input.featured_image_url) {
      payload.thumbnail_path = input.featured_image_url;
    }

    const res = await fetch(storePath(cfg, "v2", "/blog/posts"), {
      method: "POST",
      headers: buildHeaders(cfg),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new PublishError(`BigCommerce publish failed (${res.status})`, res.status, text);
    }
    const data = await res.json();
    const storeUrl = cfg.store_url?.trim().replace(/\/$/, "");
    return {
      external_id: data?.id ? String(data.id) : undefined,
      url: storeUrl && data?.url ? `${storeUrl}${data.url}` : data?.url,
      raw: { id: data?.id, is_published: data?.is_published },
    };
  },
};
