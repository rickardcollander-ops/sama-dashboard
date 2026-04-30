import type { Metadata } from "next";
import Footer from "@/components/Footer";
import CookieConsent from "@/components/CookieConsent";

export const metadata: Metadata = {
  title: "SAMA — Customer Portal",
  description: "Marketing AI dashboard for customers",
};

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex-1">{children}</div>
      <Footer />
      <CookieConsent />
    </div>
  );
}
