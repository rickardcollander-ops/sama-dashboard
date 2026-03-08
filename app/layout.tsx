import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import { ToastProvider } from "@/components/Toast";
import { UndoProvider } from "@/components/UndoToast";

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
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">
        <ToastProvider>
          <UndoProvider>
            <div className="flex h-screen overflow-hidden">
              <Sidebar />
              <div className="flex-1 flex flex-col w-0 min-w-0 pt-14 md:pt-0">
                <TopBar />
                <main className="flex-1 overflow-y-auto">{children}</main>
              </div>
            </div>
          </UndoProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
