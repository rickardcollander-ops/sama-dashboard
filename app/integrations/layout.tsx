import type { Metadata } from "next";
import JsonLd from "@/components/marketing/JsonLd";
import { pageMetadata, breadcrumbSchema } from "@/lib/marketing/seo";

export const metadata: Metadata = pageMetadata({
  title: "Integrations — Data Sources & Publishing",
  description:
    "Connect Sama AI to Google Search Console, GA4 and your CMS — publish to WordPress, Shopify, Webflow, Ghost, Wix, GitHub PR and more.",
  path: "/integrations",
});

export default function IntegrationsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={breadcrumbSchema([{ name: "Integrations", path: "/integrations" }])} />
      {children}
    </>
  );
}
