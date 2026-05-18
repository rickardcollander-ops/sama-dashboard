"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle, ArrowRight, BarChart2, CheckCircle2, ExternalLink, Globe,
  Loader2, Mail, Megaphone, Plug, RefreshCw, Search,
} from "lucide-react";
import CustomerNav from "@/components/CustomerNav";
import { useUser } from "@/lib/hooks/useUser";
import { useSite } from "@/lib/hooks/useSite";

type Status = "connected" | "not_connected" | "error" | "loading";

interface GoogleService {
  key: "search_console" | "analytics" | "ads";
  label: string;
  description: string;
  icon: typeof Search;
}

const GOOGLE_SERVICES: GoogleService[] = [
  {
    key: "search_console",
    label: "Google Search Console",
    description: "Pulls keywords, clicks and ranking from Google.",
    icon: Search,
  },
  {
    key: "analytics",
    label: "Google Analytics (GA4)",
    description: "Traffic, conversions and behaviour on the site.",
    icon: BarChart2,
  },
  {
    key: "ads",
    label: "Google Ads",
    description: "Ads and results from paid search.",
    icon: Megaphone,
  },
];

interface CmsDestination {
  id: string;
  kind: string;
  name: string;
}

interface AdPlatform {
  key: string;
  label: string;
  description: string;
}

const AD_PLATFORMS: AdPlatform[] = [
  {
    key: "meta",
    label: "Meta Ads",
    description: "Ads and results from Facebook and Instagram.",
  },
  {
    key: "linkedin",
    label: "LinkedIn Ads",
    description: "B2B ads and lead data from LinkedIn.",
  },
  {
    key: "tiktok",
    label: "TikTok Ads",
    description: "Ads and campaign results from TikTok.",
  },
  {
    key: "snapchat",
    label: "Snapchat Ads",
    description: "Ads and results from Snapchat.",
  },
];

function StatusChip({ status }: { status: Status }) {
  if (status === "loading") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
        <Loader2 className="h-3 w-3 animate-spin" />
        Checking…
      </span>
    );
  }
  if (status === "connected") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
        <CheckCircle2 className="h-3 w-3" />
        Ansluten
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
        <AlertCircle className="h-3 w-3" />
        Fel
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
      Ej ansluten
    </span>
  );
}

export default function IntegrationsPage() {
  const { user } = useUser();
  const { effectiveTenantId } = useSite();
  const [googleStatus, setGoogleStatus] = useState<Record<GoogleService["key"], Status>>({
    search_console: "loading",
    analytics: "loading",
    ads: "loading",
  });
  const [googleEmails, setGoogleEmails] = useState<Partial<Record<GoogleService["key"], string | null>>>({});
  const [cmsDestinations, setCmsDestinations] = useState<CmsDestination[] | null>(null);
  const [cmsError, setCmsError] = useState(false);

  useEffect(() => {
    if (!user || !effectiveTenantId) return;
    (async () => {
      try {
        const res = await fetch(`/api/auth/google/status?tenant_id=${effectiveTenantId}`);
        if (!res.ok) throw new Error("status");
        const data = await res.json() as Record<string, { connected?: boolean; account_email?: string | null }>;
        setGoogleStatus({
          search_console: data?.search_console?.connected ? "connected" : "not_connected",
          analytics: data?.analytics?.connected ? "connected" : "not_connected",
          ads: data?.ads?.connected ? "connected" : "not_connected",
        });
        setGoogleEmails({
          search_console: data?.search_console?.account_email ?? null,
          analytics: data?.analytics?.account_email ?? null,
          ads: data?.ads?.account_email ?? null,
        });
      } catch {
        setGoogleStatus({ search_console: "error", analytics: "error", ads: "error" });
        setGoogleEmails({});
      }
    })();

    (async () => {
      try {
        const res = await fetch("/api/integrations/destinations", {
          headers: { "X-Tenant-ID": effectiveTenantId },
        });
        if (!res.ok) throw new Error("load");
        const data = await res.json();
        setCmsDestinations(data.destinations || []);
      } catch {
        setCmsError(true);
        setCmsDestinations([]);
      }
    })();
  }, [user, effectiveTenantId]);

  const connectGoogle = (service: string) => {
    if (!user || !effectiveTenantId) return;
    const returnUrl = `${window.location.origin}/c/settings/integrations`;
    window.location.href = `/api/auth/google/connect?service=${service}&tenant_id=${effectiveTenantId}&return_url=${encodeURIComponent(returnUrl)}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50">
      <CustomerNav />

      <main className="mx-auto max-w-4xl px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Integrations</h1>
          <p className="mt-1 text-sm text-slate-500">
            Connect Google, your CMS and email so SAMA can fetch data and publish content
            for you.
          </p>
        </div>

        {/* Google */}
        <section className="rounded-xl border bg-white shadow-sm">
          <div className="border-b px-6 py-4">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-slate-500" />
              <h2 className="font-semibold text-slate-900">Google</h2>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Search stats, traffic data and ad results.
            </p>
          </div>
          <ul className="divide-y divide-slate-100">
            {GOOGLE_SERVICES.map((s) => {
              const status = googleStatus[s.key];
              const accountEmail = googleEmails[s.key];
              return (
                <li key={s.key} className="flex items-center gap-4 px-6 py-4">
                  <span className="rounded-lg bg-slate-100 p-2.5">
                    <s.icon className="h-5 w-5 text-slate-700" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900">{s.label}</span>
                      <StatusChip status={status} />
                    </div>
                    <p className="text-xs text-slate-500">{s.description}</p>
                    {status === "connected" && accountEmail && (
                      <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                        Connected as <span className="font-mono text-slate-700">{accountEmail}</span>
                      </p>
                    )}
                  </div>
                  {status === "connected" ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => connectGoogle(s.key)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                        title="Connect to a different Google account"
                      >
                        <RefreshCw className="h-3 w-3" />
                        Switch account
                      </button>
                      <Link
                        href="/c/settings"
                        className="text-sm font-medium text-slate-600 hover:text-slate-900"
                      >
                        Manage
                      </Link>
                    </div>
                  ) : (
                    <button
                      onClick={() => connectGoogle(s.key)}
                      disabled={status === "loading"}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
                    >
                      Connect
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        {/* Ads platforms */}
        <section className="mt-6 rounded-xl border bg-white shadow-sm">
          <div className="border-b px-6 py-4">
            <div className="flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-slate-500" />
              <h2 className="font-semibold text-slate-900">Ads</h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-500">
                Coming soon
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Connect your ad platforms to pull in results and optimise campaigns.
            </p>
          </div>
          <ul className="divide-y divide-slate-100">
            {AD_PLATFORMS.map((p) => (
              <li
                key={p.key}
                aria-disabled="true"
                className="flex items-center gap-4 px-6 py-4 opacity-60"
              >
                <span className="rounded-lg bg-slate-100 p-2.5">
                  <Megaphone className="h-5 w-5 text-slate-400" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-700">{p.label}</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                      Coming soon
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">{p.description}</p>
                </div>
                <button
                  type="button"
                  disabled
                  title="Coming soon"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-500 cursor-not-allowed"
                >
                  Anslut
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* CMS / Publishing */}
        <section className="mt-6 rounded-xl border bg-white shadow-sm">
          <div className="border-b px-6 py-4">
            <div className="flex items-center gap-2">
              <Plug className="h-4 w-4 text-slate-500" />
              <h2 className="font-semibold text-slate-900">CMS for publishing</h2>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              WordPress, Webflow, Shopify or similar — to publish content directly.
            </p>
          </div>
          <div className="px-6 py-4">
            {cmsDestinations === null ? (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading connected destinations…
              </div>
            ) : cmsError ? (
              <div className="flex items-center gap-2 text-sm text-red-600">
                <AlertCircle className="h-4 w-4" />
                Could not fetch destinations.
              </div>
            ) : cmsDestinations.length === 0 ? (
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-slate-700">No CMS connected yet.</p>
                  <p className="text-xs text-slate-500">
                    Without a CMS, publishing only works via email.
                  </p>
                </div>
                <Link
                  href="/c/settings"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors shadow-sm"
                >
                  Connect CMS
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                <ul className="divide-y divide-slate-100">
                  {cmsDestinations.map((d) => (
                    <li key={d.id} className="flex items-center justify-between py-2">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{d.name}</p>
                        <p className="text-xs text-slate-500 capitalize">{d.kind}</p>
                      </div>
                      <StatusChip status="connected" />
                    </li>
                  ))}
                </ul>
                <Link
                  href="/c/settings"
                  className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800"
                >
                  Manage connections
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* Mail */}
        <section className="mt-6 rounded-xl border bg-white shadow-sm">
          <div className="border-b px-6 py-4">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-slate-500" />
              <h2 className="font-semibold text-slate-900">Email for publishing</h2>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Send approved content to a webmaster, for example, instead of publishing directly.
            </p>
          </div>
          <div className="flex items-center justify-between gap-4 px-6 py-4">
            <div>
              <p className="text-sm text-slate-700">
                Default recipient is set per brand under Account.
              </p>
              <p className="text-xs text-slate-500">
                Configured in Sprint 2 — email publishing isn't active yet.
              </p>
            </div>
            <Link
              href="/c/settings"
              className="text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              Open Account
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
