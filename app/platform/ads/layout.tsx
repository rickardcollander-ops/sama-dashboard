import type { Metadata } from "next";
import JsonLd from "@/components/marketing/JsonLd";
import { pageMetadata, breadcrumbSchema } from "@/lib/marketing/seo";

export const metadata: Metadata = pageMetadata({
  title: "Ads — AI-Generated Ads and Creative",
  description:
    "AI-generated ad copy and creative for Meta, LinkedIn and Google Ads, grounded in the same brand profile that drives the content agent.",
  path: "/platform/ads",
});

export default function AdsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Platform", path: "/platform" },
          { name: "Ads", path: "/platform/ads" },
        ])}
      />
      {children}
    </>
  );
}
