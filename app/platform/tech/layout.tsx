import type { Metadata } from "next";
import JsonLd from "@/components/marketing/JsonLd";
import { pageMetadata, breadcrumbSchema } from "@/lib/marketing/seo";

export const metadata: Metadata = pageMetadata({
  title: "Tech — Site Fixes Shipped as Pull Requests",
  description:
    "Weekly crawl of up to 200 pages with technical and content fixes — internal links, schema, alt text, Core Web Vitals — shipped as GitHub PRs.",
  path: "/platform/tech",
});

export default function TechLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Platform", path: "/platform" },
          { name: "Tech", path: "/platform/tech" },
        ])}
      />
      {children}
    </>
  );
}
