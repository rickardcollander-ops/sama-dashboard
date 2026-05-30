import type { Metadata } from "next";
import JsonLd from "@/components/marketing/JsonLd";
import { pageMetadata, breadcrumbSchema } from "@/lib/marketing/seo";

export const metadata: Metadata = pageMetadata({
  title: "GEO for Agencies — White-Label Service Line",
  description:
    "Package GEO+SEO as a new service line without building a stack: multi-tenant management, white-label reports and per-client autopilot.",
  path: "/use-cases/agencies",
});

export default function AgenciesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Use Cases", path: "/use-cases" },
          { name: "Agencies", path: "/use-cases/agencies" },
        ])}
      />
      {children}
    </>
  );
}
