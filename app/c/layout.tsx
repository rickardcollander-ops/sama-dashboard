import type { Metadata } from "next";
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
  return <Providers>{children}</Providers>;
}
