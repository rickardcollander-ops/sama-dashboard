import type { Metadata } from "next";
import JsonLd from "@/components/marketing/JsonLd";
import { pageMetadata, breadcrumbSchema } from "@/lib/marketing/seo";

export const metadata: Metadata = pageMetadata({
  title: "GEO for Consulting — Become the Source AI Cites",
  description:
    "Build authority in your niche: autopilot expert content, author pages with Person schema and AI mention tracking against the firms you compete with.",
  path: "/use-cases/consulting",
});

export default function ConsultingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Use Cases", path: "/use-cases" },
          { name: "Consulting", path: "/use-cases/consulting" },
        ])}
      />
      {children}
    </>
  );
}
