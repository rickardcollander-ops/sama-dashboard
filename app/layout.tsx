import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";
import { LanguageProvider } from "@/lib/hooks/useLanguage";

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
      <body className="font-sans antialiased">
        <LanguageProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
