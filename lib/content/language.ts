// Per-site content language.
//
// Each workspace is one site with its own language: successifier.com publishes
// English, successifier.se and supportifier.se publish Swedish. The language
// lives in `user_sites.settings.content_language`.
//
// This mirrors `TenantConfig.language` in the backend (`shared/tenant.py`),
// including its country-code TLD fallback, so both sides of the wire agree on
// what language a site writes in. Keep the two in sync: a mismatch means an
// article generated in Swedish gets published tagged `lang="en"`.

import { normalizeHost } from "@/lib/domain";

/** Country-code TLD → ISO-639-1. Mirrors `_TLD_LANGUAGE_MAP` in shared/tenant.py. */
const TLD_LANGUAGE: Record<string, string> = {
  se: "sv",
  no: "nb",
  dk: "da",
  fi: "fi",
  de: "de",
  at: "de",
  ch: "de",
  fr: "fr",
  es: "es",
  it: "it",
  nl: "nl",
  be: "nl",
  pt: "pt",
  pl: "pl",
  cz: "cs",
  ru: "ru",
  jp: "ja",
  cn: "zh",
  br: "pt",
  mx: "es",
};

/** Lowercase an ISO-639-1 code, tolerating `sv-SE` style tags. */
export function normalizeLanguage(code: string | null | undefined): string {
  const raw = typeof code === "string" ? code.trim().toLowerCase() : "";
  if (!raw) return "";
  return raw.split(/[-_]/)[0];
}

/**
 * The language a domain implies, or "" when its TLD says nothing.
 *
 * `.se` → Swedish. This is what lets a site that was added without ever
 * touching the language selector still publish in the right language.
 */
export function languageFromDomain(domain: string | null | undefined): string {
  const host = normalizeHost(domain);
  if (!host.includes(".")) return "";
  const tld = host.slice(host.lastIndexOf(".") + 1);
  return TLD_LANGUAGE[tld] || "";
}

/**
 * The language a site's content should be published in.
 *
 * Resolution order, matching the backend:
 *   1. an explicit language on the piece itself (what it was actually written in)
 *   2. `settings.content_language` (the site's configured language)
 *   3. the domain's country-code TLD
 *   4. "en"
 */
export function resolveSiteLanguage(
  settings: Record<string, unknown> | null | undefined,
  pieceLanguage?: string | null,
): string {
  const fromPiece = normalizeLanguage(pieceLanguage);
  if (fromPiece) return fromPiece;

  const s = settings || {};
  const configured = normalizeLanguage(
    typeof s.content_language === "string" ? s.content_language : "",
  );
  if (configured) return configured;

  const domain = typeof s.domain === "string" ? s.domain : "";
  const blogUrl = typeof s.blog_url === "string" ? s.blog_url : "";
  return languageFromDomain(domain) || languageFromDomain(blogUrl) || "en";
}
