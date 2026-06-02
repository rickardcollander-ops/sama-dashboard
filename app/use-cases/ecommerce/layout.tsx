import type { Metadata } from "next";
import JsonLd from "@/components/marketing/JsonLd";
import { pageMetadata, breadcrumbSchema } from "@/lib/marketing/seo";

export const metadata: Metadata = pageMetadata({
  title: "GEO for E-commerce — Get Products Cited by AI",
  description:
    "Generative search is the new product search bar. Get your products cited with AI-optimised product schema, comparison content and GA4 tracking.",
  path: "/use-cases/ecommerce",
});

export default function EcommerceLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Use Cases", path: "/use-cases" },
          { name: "E-commerce", path: "/use-cases/ecommerce" },
        ])}
      />
      {children}
    </>
  );
}
