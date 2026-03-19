"use client";

import { useState, useEffect } from "react";
import {
  Search, Bot, BarChart2, FileText, RefreshCw, Play, Clock,
  CheckCircle, XCircle, ArrowRight, TrendingUp
} from "lucide-react";
import Link from "next/link";
import CustomerNav from "@/components/CustomerNav";
import { useUser } from "@/lib/hooks/useUser";
import { supabase } from "@/lib/supabase";

const SAMA_API_URL = process.env.NEXT_PUBLIC_SAMA_API_URL || "https://web-production-5324a.up.railway.app";

interface CustomerSettings {
  brand_name?: string;
  domain?: string;
  geo_queries?: string[];
  geo_platforms?: string[];
  competitors?: string[];
}

export default function CustomerDashboard() {
  const { user } = useUser();
  const [settings, setSettings] = useState<CustomerSettings>({});
  const [geoSummary, setGeoSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([loadSettings(), loadGeoSummary()]);
    setLoading(false);
  };

  const loadSettings = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from("user_settings")
        .select("settings")
        .eq("user_id", user.id)
        .single();
      if (data?.settings) setSettings(data.settings);
    } catch {
      // No settings yet
    }
  };

  const loadGeoSummary = async () => {
    try {
      const res = await fetch(`${SAMA_API_URL}/api/ai-visibility/summary`);
      if (res.ok) setGeoSummary(await res.json());
    } catch {
      // silent
    }
  };

  const hasSetup = !!(settings.brand_name && settings.domain);
  const mentionRate = geoSummary?.mention_rate ?? 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50">
      <CustomerNav />

      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
            {settings.brand_name ? `${settings.brand_name} Dashboard` : "Dashboard"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Överblick av dina marknadsföringsagenter
          </p>
        </div>

        {/* Setup prompt */}
        {!hasSetup && (
          <Link
            href="/c/settings"
            className="mb-8 flex items-center gap-4 rounded-xl border-2 border-dashed border-blue-300 bg-blue-50 p-6 hover:bg-blue-100 transition-colors"
          >
            <div className="rounded-full bg-blue-100 p-3">
              <Search className="h-6 w-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-blue-900">Kom igång</h3>
              <p className="text-sm text-blue-700">
                Konfigurera ditt varumärke, konkurrenter och GEO-sökfrågor för att starta övervakning.
              </p>
            </div>
            <ArrowRight className="h-5 w-5 text-blue-400" />
          </Link>
        )}

        {/* Agent cards */}
        <div className="grid gap-4 sm:grid-cols-2">
          {/* GEO Monitor */}
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-lg bg-violet-50 p-2.5">
                <Bot className="h-6 w-6 text-violet-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">GEO Monitor</h3>
                <p className="text-xs text-slate-500">AI Visibility i ChatGPT, Claude, Perplexity m.fl.</p>
              </div>
            </div>
            {geoSummary ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Mention Rate</span>
                  <span className={`text-lg font-bold ${mentionRate >= 0.5 ? 'text-green-600' : mentionRate > 0 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {Math.round(mentionRate * 100)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Öppna gaps</span>
                  <span className="text-lg font-bold text-slate-900">{geoSummary.open_gaps ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Totala kontroller</span>
                  <span className="text-lg font-bold text-slate-900">{geoSummary.total_checks ?? 0}</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400">Ingen data ännu. Starta en GEO-kontroll.</p>
            )}
            <Link href="/c/geo"
              className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 transition-colors">
              <Bot className="h-4 w-4" /> Öppna GEO Monitor
            </Link>
          </div>

          {/* SEO */}
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-lg bg-blue-50 p-2.5">
                <Search className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">SEO</h3>
                <p className="text-xs text-slate-500">Rankings, tekniska audits & nyckelord</p>
              </div>
            </div>
            <p className="text-sm text-slate-400 mb-4">Keyword-tracking, Core Web Vitals och tekniska audits.</p>
            <div className="rounded-lg bg-slate-50 px-4 py-3 text-center text-sm text-slate-500">
              Kommer snart
            </div>
          </div>

          {/* Content */}
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-lg bg-purple-50 p-2.5">
                <FileText className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Content</h3>
                <p className="text-xs text-slate-500">AI-genererade artiklar & sidor</p>
              </div>
            </div>
            <p className="text-sm text-slate-400 mb-4">Blogginlägg, landningssidor och jämförelsesidor.</p>
            <div className="rounded-lg bg-slate-50 px-4 py-3 text-center text-sm text-slate-500">
              Kommer snart
            </div>
          </div>

          {/* Analytics */}
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-lg bg-indigo-50 p-2.5">
                <BarChart2 className="h-6 w-6 text-indigo-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Analytics</h3>
                <p className="text-xs text-slate-500">Cross-channel metrics & ROI</p>
              </div>
            </div>
            <p className="text-sm text-slate-400 mb-4">Attribution, anomaly-detektering och rapporter.</p>
            <div className="rounded-lg bg-slate-50 px-4 py-3 text-center text-sm text-slate-500">
              Kommer snart
            </div>
          </div>
        </div>

        {/* Config summary */}
        {hasSetup && (
          <div className="mt-8 rounded-xl border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900">Din konfiguration</h3>
              <Link href="/c/settings" className="text-sm text-blue-600 hover:text-blue-800">
                Redigera
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-3 text-sm">
              <div>
                <p className="text-slate-500 mb-1">Varumärke</p>
                <p className="font-medium text-slate-900">{settings.brand_name}</p>
                <p className="text-slate-400">{settings.domain}</p>
              </div>
              <div>
                <p className="text-slate-500 mb-1">Konkurrenter</p>
                <div className="flex flex-wrap gap-1">
                  {(settings.competitors || []).map((c) => (
                    <span key={c} className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-800">{c}</span>
                  ))}
                  {(settings.competitors || []).length === 0 && <span className="text-slate-400">Inga</span>}
                </div>
              </div>
              <div>
                <p className="text-slate-500 mb-1">GEO-frågor</p>
                <p className="font-medium text-slate-900">{(settings.geo_queries || []).length} frågor</p>
                <p className="text-slate-400">{(settings.geo_platforms || []).length} plattformar</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
