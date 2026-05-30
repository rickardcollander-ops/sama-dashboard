import type { Metadata } from "next";

export const BASE_URL = "https://sama.successifier.com";

interface PageSeo {
  /** Title WITHOUT the "| Sama AI" suffix — the root layout's title.template adds it. Keep ≤ 55 chars. */
  title: string;
  /** Meta description. Keep ≤ 165 chars so Google doesn't truncate it. */
  description: string;
  /** Absolute path, e.g. "/platform/seo". Used for the canonical URL and og:url. */
  path: string;
}

/**
 * Builds page metadata with a self-referencing canonical and OpenGraph block —
 * the two things the marketing pages were missing, which left every route
 * inheriting the root default title/description and no canonical link.
 */
export function pageMetadata({ title, description, path }: PageSeo): Metadata {
  const url = `${BASE_URL}${path}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${title} | Sama AI`,
      description,
      url,
      type: "website",
    },
  };
}

interface BreadcrumbCrumb {
  name: string;
  path: string;
}

/**
 * schema.org BreadcrumbList for interior pages — gives AI assistants and Google
 * the hierarchical context the audit flagged as missing (breadcrumb schema).
 */
export function breadcrumbSchema(crumbs: BreadcrumbCrumb[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: `${BASE_URL}${c.path}`,
    })),
  };
}
