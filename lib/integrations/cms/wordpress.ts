import { CmsAdapter, PublishError, PublishInput, PublishResult } from "./types";

function normalizeBase(url: string): string {
  let u = url.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//.test(u)) u = `https://${u}`;
  // WP REST API lives at the site root. Users often paste the admin/login URL
  // (e.g. https://site.com/admin), which would push requests to a path that
  // 404s. Strip the common admin/login/REST suffixes.
  u = u.replace(/\/(wp-admin|wp-login\.php|admin|wp-json)\/?$/i, "");
  return u;
}

function buildAuthHeader(cfg: Record<string, string>): string {
  const user = cfg.username?.trim();
  const pass = cfg.app_password?.trim();
  if (!user || !pass) {
    throw new PublishError("WordPress: username and application password are required", 400);
  }
  const token = Buffer.from(`${user}:${pass}`).toString("base64");
  return `Basic ${token}`;
}

export const wordpressAdapter: CmsAdapter = {
  kind: "wordpress",

  async validate(cfg) {
    try {
      const base = normalizeBase(cfg.site_url || "");
      const res = await fetch(`${base}/wp-json/wp/v2/users/me?context=edit`, {
        headers: { Authorization: buildAuthHeader(cfg) },
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return { ok: false, message: `WordPress ${res.status}: ${text.slice(0, 160)}` };
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "Could not reach WordPress" };
    }
  },

  async publish(cfg, input: PublishInput): Promise<PublishResult> {
    const base = normalizeBase(cfg.site_url || "");
    const auth = buildAuthHeader(cfg);

    const html = input.body_html || "";
    const jsonldScript = input.jsonld
      ? `\n<script type="application/ld+json">${JSON.stringify(input.jsonld)}</script>`
      : "";

    const payload: Record<string, unknown> = {
      title: input.title,
      content: html + jsonldScript,
      status: input.status === "draft" ? "draft" : "publish",
      excerpt: input.excerpt || "",
      slug: input.slug,
    };
    if (input.meta_description) {
      payload.meta = { description: input.meta_description };
    }

    const res = await fetch(`${base}/wp-json/wp/v2/posts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: auth,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new PublishError(`WordPress publish failed (${res.status})`, res.status, text);
    }
    const data = await res.json();
    return {
      url: data.link,
      external_id: String(data.id),
      raw: { id: data.id, status: data.status },
    };
  },
};
