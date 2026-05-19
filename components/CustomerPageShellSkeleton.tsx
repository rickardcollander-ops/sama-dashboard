"use client";

import CustomerNav from "@/components/CustomerNav";

interface CustomerPageShellSkeletonProps {
  // Tailwind max-width class for the <main> container, matching the page's
  // real layout so the header + content keep the same horizontal position
  // when the loaded view renders.
  maxWidth?: "max-w-4xl" | "max-w-5xl" | "max-w-6xl";
  // Number of large card placeholders to render below the header. Pages
  // with fewer cards still feel right with a small extra reserve; pages
  // with more get less jump than they would with no reserve at all.
  rows?: number;
}

export default function CustomerPageShellSkeleton({
  maxWidth = "max-w-5xl",
  rows = 3,
}: CustomerPageShellSkeletonProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50">
      <CustomerNav />
      <main className={`mx-auto ${maxWidth} px-4 sm:px-6 py-6 sm:py-8`}>
        <div className="mb-8 flex items-start justify-between">
          <div>
            <div className="h-8 w-48 rounded-lg bg-slate-200 animate-pulse" />
            <div className="mt-2 h-4 w-64 rounded bg-slate-200 animate-pulse" />
          </div>
          <div className="hidden sm:flex gap-2">
            <div className="h-10 w-32 rounded-lg bg-slate-200 animate-pulse" />
            <div className="h-10 w-32 rounded-lg bg-slate-200 animate-pulse" />
          </div>
        </div>
        <div className="space-y-3">
          {Array.from({ length: rows }).map((_, i) => (
            <div
              key={i}
              className="h-24 rounded-xl border bg-white shadow-sm animate-pulse"
            />
          ))}
        </div>
      </main>
    </div>
  );
}
