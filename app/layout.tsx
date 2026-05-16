import type { Metadata } from "next";
import { Barlow_Condensed, Space_Grotesk } from "next/font/google";
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

export const metadata: Metadata = {
  title: "Sama AI — Generative Engine Optimization",
  description: "The complete pipeline from audit to published article — so your business is the one AI cites.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
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
