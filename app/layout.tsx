import type { Metadata } from "next";
import { Barlow_Condensed, Space_Grotesk } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";
import { LanguageProvider } from "@/lib/hooks/useLanguage";

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-barlow",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const BASE_URL = "https://sama.successifier.com";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "Sama AI — Generative Engine Optimization Platform",
    template: "%s | Sama AI",
  },
  description:
    "Sama AI is the complete GEO and SEO platform — from site audit to published article — so your business is the one AI assistants cite.",
  keywords: [
    "GEO",
    "generative engine optimization",
    "SEO",
    "AI visibility",
    "ChatGPT citations",
    "Perplexity optimization",
    "AI marketing",
    "content automation",
  ],
  authors: [{ name: "Sama AI", url: BASE_URL }],
  creator: "Sama AI",
  publisher: "Sama AI",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    siteName: "Sama AI",
    title: "Sama AI — Generative Engine Optimization Platform",
    description:
      "The complete GEO and SEO platform — from site audit to published article — so your business is the one AI assistants cite.",
    url: BASE_URL,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sama AI — Generative Engine Optimization Platform",
    description:
      "The complete GEO and SEO platform — so your business is the one AI assistants cite.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="sitemap" type="application/xml" href="/sitemap.xml" />
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-B2N3S9V9SN"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-B2N3S9V9SN');
          `}
        </Script>
      </head>
      <body className={`${barlowCondensed.variable} ${spaceGrotesk.variable} font-sans antialiased`}>
        <LanguageProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
