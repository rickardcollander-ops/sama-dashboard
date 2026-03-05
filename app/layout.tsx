import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { ToastProvider } from "@/components/Toast";

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
        <ToastProvider>
          <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <main className="flex-1 overflow-y-auto w-0 min-w-0 pt-14 md:pt-0">{children}</main>
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
