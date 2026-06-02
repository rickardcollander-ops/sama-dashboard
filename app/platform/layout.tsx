import type { Metadata } from "next";
import JsonLd from "@/components/marketing/JsonLd";
import { pageMetadata, breadcrumbSchema } from "@/lib/marketing/seo";

export const metadata: Metadata = pageMetadata({
  title: "The Platform — Five AI Agents, One Goal",
  description:
    "One platform, five AI agents — GEO monitoring, SEO, content, tech and ads — all sharing your brand data so your customers find and cite you.",
  path: "/platform",
});

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={breadcrumbSchema([{ name: "Platform", path: "/platform" }])} />
      {children}
    </>
  );
}
