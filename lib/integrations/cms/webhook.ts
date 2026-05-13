import { CmsAdapter, PublishError, PublishInput, PublishResult } from "./types";

async function hmacSignature(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const webhookAdapter: CmsAdapter = {
  kind: "webhook",

  async validate(cfg) {
    const url = cfg.url?.trim();
    if (!url || !/^https?:\/\//.test(url)) {
      return { ok: false, message: "URL is required (https recommended)" };
    }
    return { ok: true };
  },

  async publish(cfg, input: PublishInput): Promise<PublishResult> {
    const url = cfg.url?.trim();
    if (!url) throw new PublishError("Webhook: url is required", 400);

    const payload = {
      title: input.title,
      slug: input.slug,
      excerpt: input.excerpt,
      meta_description: input.meta_description,
      tags: input.tags || [],
      language: input.language,
      featured_image_url: input.featured_image_url,
      canonical_url: input.canonical_url,
      status: input.status || "published",
      body_markdown: input.body_markdown,
      body_html: input.body_html,
      jsonld: input.jsonld,
      published_at: new Date().toISOString(),
    };
    const body = JSON.stringify(payload);

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (cfg.secret) {
      headers["X-Sama-Signature"] = `sha256=${await hmacSignature(cfg.secret, body)}`;
    }
    if (cfg.bearer_token) {
      headers.Authorization = `Bearer ${cfg.bearer_token}`;
    }

    const res = await fetch(url, { method: "POST", headers, body });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new PublishError(`Webhook ${res.status}`, res.status, text);
    }
    let raw: unknown = null;
    try { raw = await res.json(); } catch { raw = await res.text().catch(() => null); }
    const r = raw as Record<string, unknown> | null;
    return {
      url: r && typeof r === "object" && typeof r.url === "string" ? r.url : undefined,
      external_id: r && typeof r === "object" && typeof r.id === "string" ? r.id : undefined,
      raw,
    };
  },
};
