import { CmsAdapter, PublishError, PublishInput, PublishResult } from "./types";

function normalizeBase(url: string): string {
  let u = url.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//.test(u)) u = `https://${u}`;
  return u;
}

async function ghostJwt(adminKey: string): Promise<string> {
  const [id, secret] = adminKey.split(":");
  if (!id || !secret || secret.length < 32) {
    throw new PublishError("Ghost: admin key ska ha format `id:secret`", 400);
  }
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    Uint8Array.from(secret.match(/.{2}/g)!.map((h) => parseInt(h, 16))),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const iat = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", kid: id, typ: "JWT" };
  const payload = { iat, exp: iat + 5 * 60, aud: "/admin/" };
  const b64 = (o: object) =>
    Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${b64(header)}.${b64(payload)}`;
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(unsigned));
  const sigB64 = Buffer.from(new Uint8Array(sig)).toString("base64url");
  return `${unsigned}.${sigB64}`;
}

export const ghostAdapter: CmsAdapter = {
  kind: "ghost",

  async validate(cfg) {
    try {
      const base = normalizeBase(cfg.api_url || "");
      const token = await ghostJwt(cfg.admin_api_key || "");
      const res = await fetch(`${base}/ghost/api/admin/site/`, {
        headers: { Authorization: `Ghost ${token}` },
      });
      if (!res.ok) return { ok: false, message: `Ghost ${res.status}` };
      return { ok: true };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "Ghost validation failed" };
    }
  },

  async publish(cfg, input: PublishInput): Promise<PublishResult> {
    const base = normalizeBase(cfg.api_url || "");
    const token = await ghostJwt(cfg.admin_api_key || "");

    const html = input.body_html || "";
    const codeinjection = input.jsonld
      ? `<script type="application/ld+json">${JSON.stringify(input.jsonld)}</script>`
      : undefined;

    const post = {
      title: input.title,
      html,
      status: input.status === "draft" ? "draft" : "published",
      slug: input.slug,
      custom_excerpt: input.excerpt || undefined,
      meta_description: input.meta_description || undefined,
      canonical_url: input.canonical_url || undefined,
      feature_image: input.featured_image_url || undefined,
      tags: input.tags?.map((name) => ({ name })) || undefined,
      codeinjection_head: codeinjection,
    };

    const res = await fetch(`${base}/ghost/api/admin/posts/?source=html`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Ghost ${token}`,
      },
      body: JSON.stringify({ posts: [post] }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new PublishError(`Ghost publish failed (${res.status})`, res.status, text);
    }
    const data = await res.json();
    const created = data.posts?.[0];
    return {
      url: created?.url,
      external_id: created?.id,
      raw: { id: created?.id, status: created?.status },
    };
  },
};
