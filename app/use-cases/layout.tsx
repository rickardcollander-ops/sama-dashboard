import type { Metadata } from "next";
import JsonLd from "@/components/marketing/JsonLd";
import { pageMetadata, breadcrumbSchema } from "@/lib/marketing/seo";

export const metadata: Metadata = pageMetadata({
  title: "Use Cases — GEO & SEO for Every Business",
  description:
    "See how Sama AI works for B2B SaaS, e-commerce, agencies, local businesses, consulting firms and media — pick your type and see the playbook.",
  path: "/use-cases",
});

export default function UseCasesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={breadcrumbSchema([{ name: "Use Cases", path: "/use-cases" }])} />
      {children}
    </>
  );
}
