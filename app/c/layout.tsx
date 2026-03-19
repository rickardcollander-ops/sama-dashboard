import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SAMA — Customer Portal",
  description: "Marketing AI dashboard for customers",
};

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
