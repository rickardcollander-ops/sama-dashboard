import type { Metadata } from "next";
import JsonLd from "@/components/marketing/JsonLd";
import { pageMetadata, breadcrumbSchema } from "@/lib/marketing/seo";

export const metadata: Metadata = pageMetadata({
  title: "GEO for Local Business — Win Local AI Answers",
  description:
    "Be the answer when someone asks AI for the best in your city: automatic LocalBusiness schema, region-specific content and local GEO monitoring.",
  path: "/use-cases/local-business",
});

export default function LocalBusinessLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Use Cases", path: "/use-cases" },
          { name: "Local Business", path: "/use-cases/local-business" },
        ])}
      />
      {children}
    </>
  );
}
