import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/c/", "/api/"],
      },
    ],
    sitemap: "https://sama.successifier.com/sitemap.xml",
    host: "https://sama.successifier.com",
  };
}
