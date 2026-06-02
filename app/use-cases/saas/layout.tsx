import type { Metadata } from "next";
import JsonLd from "@/components/marketing/JsonLd";
import { pageMetadata, breadcrumbSchema } from "@/lib/marketing/seo";

export const metadata: Metadata = pageMetadata({
  title: "GEO for B2B SaaS — Be the Tool AI Recommends",
  description:
    "Your customers ask AI which tool to choose. Sama AI makes you the answer with weekly GEO reports, intent-driven articles and GSC + GA4 insight.",
  path: "/use-cases/saas",
});

export default function SaasLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Use Cases", path: "/use-cases" },
          { name: "B2B SaaS", path: "/use-cases/saas" },
        ])}
      />
      {children}
    </>
  );
}
