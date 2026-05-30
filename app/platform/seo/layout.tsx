import type { Metadata } from "next";
import JsonLd from "@/components/marketing/JsonLd";
import { pageMetadata, breadcrumbSchema } from "@/lib/marketing/seo";

export const metadata: Metadata = pageMetadata({
  title: "SEO + Google — Classic SEO on Autopilot",
  description:
    "Nightly Google Search Console sync, ranking tracking on 100+ keywords per site, and concrete fixes shipped as Pull Requests by the Tech agent.",
  path: "/platform/seo",
});

export default function SeoLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Platform", path: "/platform" },
          { name: "SEO + Google", path: "/platform/seo" },
        ])}
      />
      {children}
    </>
  );
}
