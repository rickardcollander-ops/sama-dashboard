import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, loadSiteSettings, resolveSiteId } from "@/lib/integrations/store";
import {
  ArticleFields,
  fetchSitemapEntries,
  injectInternalLinksMulti,
  resolveSiteOrigin,
} from "@/lib/integrations/internal-links";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Weaves internal links sourced from the site's own sitemap into an article's
 * markdown. Pure transform — the caller decides whether to persist the result.
 * Returns the input unchanged (links_added: 0) when the site has no resolvable
 * domain or no usable sitemap, so callers can apply it unconditionally.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const siteId = resolveSiteId(req, user.id);

  const body = (await req.json().catch(() => ({}))) as {
    markdown?: string;
    intro_md?: string;
    sections?: Array<{ id?: string; heading?: string; body_md?: string }>;
    self_href?: string;
  };

  const fields: ArticleFields = {
    markdown: typeof body.markdown === "string" ? body.markdown : undefined,
    intro_md: typeof body.intro_md === "string" ? body.intro_md : undefined,
    sections: Array.isArray(body.sections) ? body.sections : undefined,
  };

  const settings = await loadSiteSettings(siteId);
  const settingStr = (k: string) => (typeof settings[k] === "string" ? (settings[k] as string) : undefined);
  const origin = resolveSiteOrigin(settingStr("blog_url"), settingStr("domain"));

  if (!origin) {
    return NextResponse.json({ ...fields, links_added: 0, sitemap_count: 0, origin: null });
  }

  const entries = await fetchSitemapEntries(origin);
  const { fields: out, linksAdded } = injectInternalLinksMulti(fields, entries, {
    selfHref: body.self_href ?? null,
  });

  return NextResponse.json({
    ...out,
    links_added: linksAdded,
    sitemap_count: entries.length,
    origin,
  });
}
