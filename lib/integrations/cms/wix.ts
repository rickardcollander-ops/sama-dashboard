import { CmsAdapter, PublishError, PublishInput, PublishResult } from "./types";

const API = "https://www.wixapis.com";

function buildHeaders(cfg: Record<string, string>): HeadersInit {
  const headers: Record<string, string> = {
    Authorization: cfg.api_key?.trim() || "",
    "Content-Type": "application/json",
  };
  if (cfg.site_id) headers["wix-site-id"] = cfg.site_id.trim();
  if (cfg.account_id) headers["wix-account-id"] = cfg.account_id.trim();
  return headers;
}

export const wixAdapter: CmsAdapter = {
  kind: "wix",

  async validate(cfg) {
    const apiKey = cfg.api_key?.trim();
    const siteId = cfg.site_id?.trim();
    if (!apiKey || !siteId) {
      return { ok: false, message: "api_key och site_id krävs" };
    }
    const res = await fetch(
      `${API}/blog/v3/posts/query`,
      {
        method: "POST",
        headers: buildHeaders(cfg),
        body: JSON.stringify({ query: { paging: { limit: 1 } } }),
      },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, message: `Wix ${res.status}: ${text.slice(0, 160)}` };
    }
    return { ok: true };
  },

  async publish(cfg, input: PublishInput): Promise<PublishResult> {
    const apiKey = cfg.api_key?.trim();
    const siteId = cfg.site_id?.trim();
    if (!apiKey || !siteId) {
      throw new PublishError("Wix: api_key och site_id krävs", 400);
    }

    const richContent = {
      nodes: [
        {
          type: "PARAGRAPH",
          id: "p1",
          nodes: [
            {
              type: "TEXT",
              id: "t1",
              nodes: [],
              textData: { text: input.body_markdown },
            },
          ],
        },
      ],
    };

    const draftPost: Record<string, unknown> = {
      title: input.title,
      slug: input.slug,
      excerpt: input.excerpt || undefined,
      tagIds: undefined,
      memberId: cfg.member_id || undefined,
      richContent,
      seoData: input.meta_description
        ? { tags: [{ type: "meta", props: { name: "description", content: input.meta_description } }] }
        : undefined,
      media: input.featured_image_url
        ? { wixMedia: { image: { url: input.featured_image_url } }, displayed: true }
        : undefined,
    };

    const draftRes = await fetch(`${API}/blog/v3/draft-posts`, {
      method: "POST",
      headers: buildHeaders(cfg),
      body: JSON.stringify({ draftPost }),
    });
    if (!draftRes.ok) {
      const text = await draftRes.text().catch(() => "");
      throw new PublishError(`Wix draft failed (${draftRes.status})`, draftRes.status, text);
    }
    const draftData = await draftRes.json();
    const draftId = draftData?.draftPost?.id;
    if (!draftId) {
      throw new PublishError("Wix: kunde inte läsa draft id", 500, draftData);
    }

    if (input.status === "draft") {
      return { external_id: draftId, raw: draftData };
    }

    const pubRes = await fetch(`${API}/blog/v3/draft-posts/${draftId}/publish`, {
      method: "POST",
      headers: buildHeaders(cfg),
      body: JSON.stringify({}),
    });
    if (!pubRes.ok) {
      const text = await pubRes.text().catch(() => "");
      throw new PublishError(`Wix publish failed (${pubRes.status})`, pubRes.status, text);
    }
    const pubData = await pubRes.json();
    const post = pubData?.post;
    return {
      external_id: post?.id || draftId,
      url: post?.url?.base && post?.url?.path ? `${post.url.base}${post.url.path}` : undefined,
      raw: pubData,
    };
  },
};
