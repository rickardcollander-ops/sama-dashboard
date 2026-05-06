import type { Metadata } from "next";
import Footer from "@/components/Footer";
import CookieConsent from "@/components/CookieConsent";
import Providers from "./Providers";

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
    <Providers>
      <div className="flex min-h-screen flex-col lg:pl-56">
        <div className="flex-1">{children}</div>
        <Footer />
        <CookieConsent />
      </div>
    </Providers>
  );
}
