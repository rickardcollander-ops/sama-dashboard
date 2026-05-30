import type { Metadata } from "next";
import JsonLd from "@/components/marketing/JsonLd";
import { pageMetadata, breadcrumbSchema } from "@/lib/marketing/seo";

export const metadata: Metadata = pageMetadata({
  title: "GEO for Media — Win Back Traffic from AI",
  description:
    "AI Overviews are eating editorial traffic. Become the source AI cites with GEO tracking, citation-optimised restructuring and FAQPage schema.",
  path: "/use-cases/media",
});

export default function MediaLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Use Cases", path: "/use-cases" },
          { name: "Media", path: "/use-cases/media" },
        ])}
      />
      {children}
    </>
  );
}
