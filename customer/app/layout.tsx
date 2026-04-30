import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SAMA — Successifier Marketing AI",
  description: "Autonomous marketing agents for your brand",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
