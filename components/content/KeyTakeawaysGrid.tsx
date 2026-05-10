"use client";

import { Sparkles } from "lucide-react";

interface Item {
  point: string;
  details: string;
}

interface Props {
  items: Item[];
}

export default function KeyTakeawaysGrid({ items }: Props) {
  if (!items?.length) return null;
  return (
    <section className="my-12 rounded-3xl border border-slate-200 bg-gradient-to-br from-orange-50/40 via-white to-white p-6 sm:p-8">
      <div className="flex items-center gap-2 mb-5">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 text-orange-600">
          <Sparkles className="h-4 w-4" />
        </span>
        <h2 className="text-xl font-semibold text-slate-900">Key Takeaways</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {items.map((t, i) => (
          <div
            key={i}
            className="rounded-2xl border border-slate-200 bg-white p-4 hover:border-orange-200 hover:shadow-sm transition-all"
          >
            <div className="flex items-start gap-3">
              <span className="text-xs font-semibold tracking-wider text-orange-600 tabular-nums shrink-0 mt-0.5">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <div className="font-semibold text-slate-900 mb-1">{t.point}</div>
                <div className="text-sm text-slate-600 leading-relaxed">{t.details}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
