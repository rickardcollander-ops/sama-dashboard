import type { Metadata } from "next";
import "./globals.css";
import LayoutShell from "@/components/LayoutShell";
import { ToastProvider } from "@/components/Toast";
import { LanguageProvider } from "@/lib/hooks/useLanguage";

export const metadata: Metadata = {
  title: "SAMA 2.0 — Successifier Marketing AI",
  description: "Autonomous marketing agent dashboard for Successifier",
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
            <LayoutShell>{children}</LayoutShell>
          </ToastProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
