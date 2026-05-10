"use client";

import { MessageCircle, Bookmark, Search, Eye } from "lucide-react";
import CustomerNav from "@/components/CustomerNav";
import { useLanguage } from "@/lib/hooks/useLanguage";

export default function CustomerRedditPage() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50">
      <CustomerNav />

      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-3">
              <MessageCircle className="h-7 w-7 text-orange-500" />
              Reddit AI Agent
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Know exactly when, where and what to say on Reddit to increase your brand visibility.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-500 uppercase">
            {t.common.comingSoon}
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 mb-8">
          <StatCard label="Opportunities" value="—" hint="Number of Reddit opportunities" icon={Bookmark} />
          <StatCard label="Monitored Keywords" value="—" hint="Keywords you are tracking" icon={Search} />
          <StatCard label="Search Volume" value="—" hint="Number of people who will see Reddit posts" icon={Eye} />
        </div>

        <div className="rounded-xl border bg-white p-16 shadow-sm text-center">
          <MessageCircle className="mx-auto h-10 w-10 text-slate-300 mb-3" />
          <p className="text-sm text-slate-500">The Reddit agent isn&apos;t live yet.</p>
          <p className="text-xs text-slate-400 mt-1">
            Soon: monitor subreddits for buying-intent conversations, generate on-brand replies, and track reach.
          </p>
        </div>
      </main>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</span>
        <Icon className="h-4 w-4 text-slate-300" />
      </div>
      <span className="text-3xl font-bold text-slate-900">{value}</span>
      <p className="text-xs text-slate-400 mt-2">{hint}</p>
    </div>
  );
}
