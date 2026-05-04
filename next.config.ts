import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/audit", destination: "/c/audit", permanent: true },
      { source: "/audit/r/:id", destination: "/c/audit/r/:id", permanent: true },
    ];
  },
};

export default nextConfig;
