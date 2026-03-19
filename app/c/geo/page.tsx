"use client";

import CustomerNav from "@/components/CustomerNav";
import AIVisibilityPage from "@/app/ai-visibility/page";

export default function CustomerGeoPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50">
      <CustomerNav />
      <AIVisibilityPage />
    </div>
  );
}
