import type { NextConfig } from "next";

// Content-Security-Policy is rolled out in Report-Only mode first (set CSP_ENFORCE=1
// to flip to enforcement once Sentry shows a clean violation report). The directive
// list is intentionally explicit — wildcards are easy mistakes to make.
const CSP_ENFORCE = process.env.CSP_ENFORCE === "1";

const CSP_DIRECTIVES = [
  "default-src 'self'",
  // Next.js inlines critical CSS and uses a small inline runtime; 'unsafe-inline'
  // for style-src is unavoidable until we adopt nonces. Script-src keeps strict.
  "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://www.googletagmanager.com https://va.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  // GA4 (gtag) routes hits to regional collectors — region1/region2.google-
  // analytics.com and analytics.google.com — not just www. Scope the wildcard
  // to the analytics vendors so enabling CSP_ENFORCE doesn't break tracking.
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.anthropic.com https://web-production-5324a.up.railway.app https://*.vercel.app https://challenges.cloudflare.com https://*.google-analytics.com https://*.analytics.google.com",
  "frame-src 'self' https://challenges.cloudflare.com",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  // `upgrade-insecure-requests` is ignored in report-only mode and the browser
  // logs a console warning when it appears there, so only emit it once CSP is
  // actually enforced.
  ...(CSP_ENFORCE ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  {
    key: CSP_ENFORCE ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only",
    value: CSP_DIRECTIVES,
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  ...(process.env.NODE_ENV === "production"
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  // Tree-shake icon and chart libraries that re-export hundreds of symbols
  // from a single barrel — without this, the dashboard ships every Lucide
  // icon and the full Recharts surface even when a page only uses a few.
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts", "date-fns"],
  },
  async redirects() {
    return [
      { source: "/c/audit", destination: "/audit", permanent: true },
      { source: "/c/audit/r/:id", destination: "/audit/r/:id", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  poweredByHeader: false,
};

export default nextConfig;
