import { CmsAdapter, PublishError, PublishInput, PublishResult } from "./types";

function apiBase(region: string): string {
  switch (region.toLowerCase()) {
    case "eu":
      return "https://api.eu.duda.co";
    case "ca":
      return "https://api.ca.duda.co";
    case "us":
    default:
      return "https://api.duda.co";
  }
}

function buildAuthHeader(cfg: Record<string, string>): string {
  const user = cfg.api_user?.trim();
  const pass = cfg.api_pass?.trim();
  if (!user || !pass) {
    throw new PublishError("Duda: api_user och api_pass krävs", 400);
  }
  return `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;
}

export const dudaAdapter: CmsAdapter = {
  kind: "duda",

  async validate(cfg) {
    try {
      const site = cfg.site_name?.trim();
      if (!site) return { ok: false, message: "site_name krävs" };
      const base = apiBase(cfg.region || "us");
      const res = await fetch(`${base}/api/sites/multiscreen/${encodeURIComponent(site)}`, {
        headers: { Authorization: buildAuthHeader(cfg) },
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return { ok: false, message: `Duda ${res.status}: ${text.slice(0, 160)}` };
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "Duda validation failed" };
    }
  },

  async publish(cfg, input: PublishInput): Promise<PublishResult> {
    const site = cfg.site_name?.trim();
    if (!site) throw new PublishError("Duda: site_name krävs", 400);
    const base = apiBase(cfg.region || "us");
    const auth = buildAuthHeader(cfg);

    const html = input.body_html || "";
    const jsonldScript = input.jsonld
      ? `\n<script type="application/ld+json">${JSON.stringify(input.jsonld)}</script>`
      : "";

    const payload: Record<string, unknown> = {
      title: input.title,
      slug: input.slug,
      content: html + jsonldScript,
      status: input.status === "draft" ? "DRAFT" : "PUBLISH",
      meta_description: input.meta_description || input.excerpt,
      meta_title: input.title,
      tags: input.tags || [],
    };
    if (input.featured_image_url) {
      payload.cover_image = { url: input.featured_image_url };
    }

    const res = await fetch(
      `${base}/api/sites/multiscreen/${encodeURIComponent(site)}/content/blog/posts`,
      {
        method: "POST",
        headers: {
          Authorization: auth,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new PublishError(`Duda publish failed (${res.status})`, res.status, text);
    }
    const data = await res.json().catch(() => ({}));
    return {
      external_id: data?.id ? String(data.id) : data?.uuid,
      url: data?.url || data?.live_url,
      raw: data,
    };
  },
};
