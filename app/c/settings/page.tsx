"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Settings, Key, Globe, Users, Search, Bot, Save, CheckCircle,
  AlertCircle, Eye, EyeOff, Plus, X, Loader2, Megaphone,
  ChevronDown, ChevronUp, Unplug, BarChart2, ExternalLink, Rocket,
  Play, Activity, Zap, Code2, Link, Info, Star, Compass, RefreshCw, Sparkles, MapPin, Image,
} from "lucide-react";
import type { TargetLocation } from "@/lib/types/location";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { useUser } from "@/lib/hooks/useUser";
import { useSite } from "@/lib/hooks/useSite";
import { useLanguage } from "@/lib/hooks/useLanguage";
import { api, tenantApi, watchAgentRun } from "@/lib/api";
import CustomerNav from "@/components/CustomerNav";
import CustomerPageShellSkeleton from "@/components/CustomerPageShellSkeleton";
import PublishingDestinations from "@/components/PublishingDestinations";
import GoogleAnalyticsPropertyPicker from "@/components/GoogleAnalyticsPropertyPicker";
import GoogleSearchConsolePropertyPicker from "@/components/GoogleSearchConsolePropertyPicker";
import TeamManagementPanel from "@/components/TeamManagementPanel";
import LocalMarketEditor from "@/components/LocalMarketEditor";

interface UserSettings {
  brand_name: string;
  domain: string;
  country: string;
  language: string;
  content_language: string;
  brand_description: string;
  business_type: string;
  target_audience: string;
  unique_selling_points: string;
  tone_of_voice: string;
  competitors: string[];
  geo_queries: string[];
  geo_platforms: string[];
  meta_ads_token: string;
  meta_ads_account_id: string;
  linkedin_ads_token: string;
  linkedin_ads_account_id: string;
  google_ads_token: string;
  google_ads_account_id: string;
  publish_email_recipient: string;
  publish_email_recipient_name: string;
  team_members: string[];
  target_locations?: TargetLocation[];
  image_provider?: string;
}

const CONTENT_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "sv", label: "Swedish" },
  { code: "de", label: "German" },
  { code: "fr", label: "French" },
  { code: "es", label: "Spanish" },
  { code: "no", label: "Norwegian" },
  { code: "da", label: "Danish" },
  { code: "fi", label: "Finnish" },
  { code: "nl", label: "Dutch" },
];

const BUSINESS_TYPES = [
  { code: "ecommerce", label: "E-commerce" },
  { code: "local_service", label: "Local service" },
  { code: "saas", label: "SaaS" },
  { code: "media", label: "Media" },
  { code: "agency", label: "Agency" },
  { code: "consulting", label: "Consulting" },
  { code: "non_profit", label: "Non-profit" },
  { code: "other", label: "Other" },
];

const DEFAULT_SETTINGS: UserSettings = {
  brand_name: "",
  domain: "",
  country: "SE",
  language: "sv",
  content_language: "sv",
  brand_description: "",
  business_type: "",
  target_audience: "",
  unique_selling_points: "",
  tone_of_voice: "professional",
  competitors: [],
  geo_queries: [],
  geo_platforms: ["ChatGPT", "Perplexity", "Claude", "Google AIO"],
  meta_ads_token: "",
  meta_ads_account_id: "",
  linkedin_ads_token: "",
  linkedin_ads_account_id: "",
  google_ads_token: "",
  google_ads_account_id: "",
  publish_email_recipient: "",
  publish_email_recipient_name: "",
  team_members: [],
  image_provider: "unsplash",
};

const AVAILABLE_PLATFORMS = ["ChatGPT", "Perplexity", "Claude", "Google AIO", "Gemini", "Microsoft Copilot"];

const IMAGE_PROVIDERS = [
  { code: "unsplash", label: "Unsplash", desc: "Gratis högkvalitativa stockfoton" },
  { code: "pexels", label: "Pexels", desc: "Gratis stockfoton och videor" },
  { code: "none", label: "Ingen bild", desc: "Generera artiklar utan bilder" },
];

interface GoogleServiceStatus {
  search_console: boolean;
  analytics: boolean;
  ads: boolean;
}

type GoogleServiceKey = "search_console" | "analytics" | "ads";
type GoogleAccountEmails = Partial<Record<GoogleServiceKey, string | null>>;

const GOOGLE_SERVICES = [
  { key: "search_console" as const, label: "Google Search Console", icon: Search, description: "View search data, clicks and positions from Google" },
  { key: "analytics" as const, label: "Google Analytics (GA4)", icon: BarChart2, description: "View traffic, conversions and behavior data" },
  { key: "ads" as const, label: "Google Ads", icon: Megaphone, description: "Manage campaigns and view ad results" },
];

const AGENT_INFO: Record<string, { label: string; icon: React.ElementType }> = {
  seo: { label: "SEO Agent", icon: Search },
  content: { label: "Content Agent", icon: Bot },
  social: { label: "Social Agent", icon: Users },
  ads: { label: "Ads Agent", icon: Megaphone },
  reviews: { label: "Reviews Agent", icon: Star },
  analytics: { label: "Analytics Agent", icon: BarChart2 },
  geo: { label: "GEO Monitor", icon: Globe },
  strategy: { label: "Strategy Agent", icon: Compass },
};

// Agents shown in settings UI — inactive ones are hidden until ready
const ACTIVE_AGENTS = new Set(["seo", "content", "analytics", "geo"]);

// Used as fallback when no configs exist yet
const ALL_AGENT_DEFAULTS = [
  { name: "seo", enabled: true, schedule: "daily", last_run: null },
  { name: "content", enabled: true, schedule: "weekly", last_run: null },
  { name: "social", enabled: true, schedule: "daily", last_run: null },
  { name: "ads", enabled: false, schedule: "manual", last_run: null },
  { name: "reviews", enabled: true, schedule: "daily", last_run: null },
  { name: "analytics", enabled: true, schedule: "daily", last_run: null },
  { name: "geo", enabled: true, schedule: "weekly", last_run: null },
  { name: "strategy", enabled: true, schedule: "weekly", last_run: null },
];

export default function CustomerSettingsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50">
        <CustomerNav />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      </div>
    }>
      <CustomerSettingsPageInner />
    </Suspense>
  );
}

function CustomerSettingsPageInner() {
  const { user } = useUser();
  const { activeSite, reloadSites, tenantClient, effectiveTenantId, effectiveOwnerId, viewAs } = useSite();
  const { t } = useLanguage();
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [newCompetitor, setNewCompetitor] = useState("");
  const [expandedAdPlatform, setExpandedAdPlatform] = useState<string | null>(null);
  const [googleStatus, setGoogleStatus] = useState<GoogleServiceStatus>({ search_console: false, analytics: false, ads: false });
  const [googleEmails, setGoogleEmails] = useState<GoogleAccountEmails>({});
  const [googleLoading, setGoogleLoading] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [googleError, setGoogleError] = useState("");

  interface AgentConfig { name: string; enabled: boolean; schedule: string; last_run: string | null; }
  interface AgentRun { id: string; agent_name: string; status: string; started_at: string; completed_at: string | null; summary: string | null; }
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [agentRuns, setAgentRuns] = useState<AgentRun[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [triggeringAgent, setTriggeringAgent] = useState<string | null>(null);
  const [togglingAgent, setTogglingAgent] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);
  const [activationResult, setActivationResult] = useState<{ keywords_added: number; content_created: number } | null>(null);

  interface GitHubStatus { connected: boolean; repo_owner?: string; repo_name?: string; repo?: string; blog_path?: string; branch?: string; token_masked?: string; }
  interface GitHubRepo { full_name: string; owner: string; name: string; private: boolean; default_branch: string; }
  const [ghStatus, setGhStatus] = useState<GitHubStatus>({ connected: false });
  const [ghLoading, setGhLoading] = useState(true);
  const [ghToken, setGhToken] = useState("");
  const [ghShowToken, setGhShowToken] = useState(false);
  const [ghRepos, setGhRepos] = useState<GitHubRepo[]>([]);
  const [ghReposLoading, setGhReposLoading] = useState(false);
  const [ghSelectedRepo, setGhSelectedRepo] = useState("");
  const [ghBlogPath, setGhBlogPath] = useState("content/blog");
  const [ghBranch, setGhBranch] = useState("main");
  const [ghConnecting, setGhConnecting] = useState(false);
  const [ghError, setGhError] = useState("");
  const [ghTokenValidated, setGhTokenValidated] = useState(false);
  const [blogUrl, setBlogUrl] = useState("");

  const searchParams = useSearchParams();
  const googleConnected = searchParams.get("google_connected");
  const googleErrorParam = searchParams.get("google_error");

  useEffect(() => { if (user) loadSettings(); }, [user, activeSite?.id]);
  useEffect(() => { if (error) { const t = setTimeout(() => setError(""), 8000); return () => clearTimeout(t); } }, [error]);
  useEffect(() => { if (user && effectiveTenantId) loadGoogleStatus(); }, [user, effectiveTenantId]);
  useEffect(() => { if (user) loadAgentStatus(); }, [user, effectiveTenantId]);
  useEffect(() => { if (user) loadGitHubStatus(); }, [user, effectiveTenantId]);

  const loadGitHubStatus = async () => {
    if (!user) return;
    setGhLoading(true);
    try {
      const data = await tenantClient.get<GitHubStatus>("/api/integrations/github/status");
      setGhStatus(data);
      if (data.connected) { setGhBlogPath(data.blog_path || "content/blog"); setGhBranch(data.branch || "main"); }
    } catch { setGhStatus({ connected: false }); }
    setGhLoading(false);
  };

  const handleGhValidateToken = async () => {
    if (!user || !ghToken.trim()) return;
    setGhConnecting(true); setGhError("");
    try {
      await tenantClient.post("/api/integrations/github/connect", { github_token: ghToken });
      setGhTokenValidated(true);
      setGhReposLoading(true);
      try {
        const repoData = await tenantClient.get<{ repos: GitHubRepo[] }>("/api/integrations/github/repos");
        setGhRepos(repoData.repos || []);
      } catch { setGhError("Could not fetch repos. Verify your token has repo scope."); }
      setGhReposLoading(false);
    } catch (err: any) { setGhError(err?.message || "Invalid token"); }
    setGhConnecting(false);
  };

  const handleGhConnect = async () => {
    if (!user || !ghSelectedRepo) return;
    setGhConnecting(true); setGhError("");
    const [owner, name] = ghSelectedRepo.split("/");
    try {
      await tenantClient.post("/api/integrations/github/connect", { github_token: ghToken, repo_owner: owner, repo_name: name, blog_path: ghBlogPath, branch: ghBranch });
      await loadGitHubStatus();
      setGhToken(""); setGhTokenValidated(false); setGhRepos([]);
      setSuccessMessage("GitHub connected!");
    } catch (err: any) { setGhError(err?.message || "Could not connect"); }
    setGhConnecting(false);
  };

  const handleGhDisconnect = async () => {
    if (!user) return;
    setGhConnecting(true);
    try {
      await tenantClient.post("/api/integrations/github/disconnect", {});
      setGhStatus({ connected: false }); setGhTokenValidated(false); setGhToken(""); setGhRepos([]);
    } catch { setGhError("Could not disconnect"); }
    setGhConnecting(false);
  };

  const handleSaveBlogUrl = async () => {
    if (!user) return;
    try {
      // In view-as, `user` is the admin — falling back to admin's id would
      // collide with the admin's own site row. Use the viewed user's id so
      // the upsert creates/finds the customer's first site.
      const siteId = activeSite?.id ?? (viewAs ? viewAs.userId : user.id);
      const ownerId = activeSite?.user_id ?? effectiveOwnerId ?? user.id;
      const nextSettings = { ...settings, blog_url: blogUrl };
      const siteName = settings.brand_name || activeSite?.site_name || "";
      if (viewAs) {
        const res = await fetch(`/api/admin/user-sites/${viewAs.userId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: siteId, site_name: siteName, settings: nextSettings }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
      } else {
        const { error: upsertError } = await getSupabaseBrowser().from("user_sites").upsert({ id: siteId, user_id: ownerId, site_name: siteName, settings: nextSettings, updated_at: new Date().toISOString() }, { onConflict: "id" });
        if (upsertError) throw upsertError;
      }
      setSuccessMessage("Blog URL saved!");
    } catch { setError("Could not save blog URL"); }
  };

  const loadAgentStatus = async () => {
    if (!user) return;
    setAgentsLoading(true);
    try {
      const [statusData, runsData] = await Promise.all([
        tenantClient.get<{ agents: AgentConfig[] }>("/api/tenant/agent-status"),
        tenantClient.get<{ runs: AgentRun[] }>("/api/tenant/agent-runs?limit=10"),
      ]);
      setAgents(statusData.agents || []); setAgentRuns(runsData.runs || []);
    } catch { setAgents([]); setAgentRuns([]); }
    setAgentsLoading(false);
  };

  const handleToggleAgent = async (agentName: string, enabled: boolean) => {
    if (!user) return;
    setTogglingAgent(agentName);
    try {
      await tenantClient.post(`/api/tenant/agents/${agentName}/toggle`, { enabled });
      setAgents((prev) => prev.map((a) => (a.name === agentName ? { ...a, enabled } : a)));
    } catch { setError("Could not update agent"); }
    setTogglingAgent(null);
  };

  const handleTriggerAgent = async (agentName: string) => {
    if (!user) return;
    setTriggeringAgent(agentName);
    try {
      const resp = await tenantClient.post<{ run_id?: string; status?: string }>(`/api/tenant/agents/${agentName}/trigger`, undefined, { headers: { "X-Sama-Intent": "user-action" } });
      await loadAgentStatus();
      if (resp?.run_id && resp?.status === "running") {
        const tenantId = activeSite?.id ?? user.id;
        watchAgentRun(tenantId, resp.run_id).then(() => loadAgentStatus()).catch(() => {});
      }
    } catch { setError(`Could not run the ${agentName} agent`); }
    setTriggeringAgent(null);
  };

  const handleActivate = async () => {
    if (!user) return;
    setActivating(true); setActivationResult(null);
    try {
      const result = await tenantClient.post<{ keywords_added: number; content_created: number }>("/api/tenant/activate");
      setActivationResult(result); await loadAgentStatus();
    } catch { setError("Activation failed. Please try again."); }
    setActivating(false);
  };

  useEffect(() => {
    if (googleConnected) { setSuccessMessage(`${googleConnected} connected!`); window.history.replaceState({}, "", "/c/settings"); loadGoogleStatus(); }
    if (googleErrorParam) { setGoogleError("Could not connect to Google. Please try again."); window.history.replaceState({}, "", "/c/settings"); }
  }, [googleConnected, googleErrorParam]);

  const loadGoogleStatus = async () => {
    if (!user) return;
    try {
      const data = await api.get<Record<string, { connected?: boolean; account_email?: string | null }>>(`/api/auth/google/status?tenant_id=${effectiveTenantId}`);
      setGoogleStatus({ search_console: !!data?.search_console?.connected, analytics: !!data?.analytics?.connected, ads: !!data?.ads?.connected });
      setGoogleEmails({ search_console: data?.search_console?.account_email ?? null, analytics: data?.analytics?.account_email ?? null, ads: data?.ads?.account_email ?? null });
    } catch { setGoogleStatus({ search_console: false, analytics: false, ads: false }); setGoogleEmails({}); }
  };

  const connectGoogle = (service: string) => {
    if (!user) return;
    const returnUrl = `${window.location.origin}/c/settings`;
    window.location.href = `${api.baseUrl}/api/auth/google/connect?service=${service}&tenant_id=${effectiveTenantId}&return_url=${encodeURIComponent(returnUrl)}`;
  };

  const disconnectGoogle = async (service: string) => {
    if (!user) return;
    setGoogleLoading(service);
    try { await api.delete(`/api/auth/google/disconnect?service=${service}&tenant_id=${effectiveTenantId}`); await loadGoogleStatus(); }
    catch { setGoogleError("Could not disconnect. Please try again."); }
    setGoogleLoading(null);
  };

  const loadSettings = async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    setSettings(DEFAULT_SETTINGS);
    setBlogUrl("");
    try {
      const raw = activeSite?.settings && Object.keys(activeSite.settings).length > 0
        ? activeSite.settings
        : null;
      if (raw) {
        setSettings({ ...DEFAULT_SETTINGS, ...(raw as Partial<UserSettings>) });
        if (raw.blog_url) setBlogUrl(raw.blog_url as string);
      }
    } catch { /* First time — defaults are fine. */ }
    setLoading(false);
  };

  const saveSettings = async () => {
    if (!user) return;
    setSaving(true); setError(""); setSaved(false);
    try {
      // In view-as, `user` is the admin — falling back to admin's id would
      // collide with the admin's own site row. Use the viewed user's id so
      // the upsert creates/finds the customer's first site.
      const siteId = activeSite?.id ?? (viewAs ? viewAs.userId : user.id);
      const ownerId = activeSite?.user_id ?? effectiveOwnerId ?? user.id;
      const siteName = settings.brand_name || activeSite?.site_name || "";
      if (viewAs) {
        const res = await fetch(`/api/admin/user-sites/${viewAs.userId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: siteId, site_name: siteName, settings }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
      } else {
        const { error: upsertError } = await getSupabaseBrowser().from("user_sites").upsert({ id: siteId, user_id: ownerId, site_name: siteName, settings, updated_at: new Date().toISOString() }, { onConflict: "id" });
        if (upsertError) throw upsertError;
      }
      await reloadSites();
      setSaved(true); setTimeout(() => setSaved(false), 5000);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : "Could not save"); }
    setSaving(false);
  };

  const updateField = (field: keyof UserSettings, value: string) => setSettings((prev) => ({ ...prev, [field]: value }));

  const [aiFilling, setAiFilling] = useState(false);
  const [aiFillError, setAiFillError] = useState("");

  const handleAiFill = async () => {
    const domain = settings.domain.trim();
    if (!domain) return;
    setAiFilling(true); setAiFillError("");
    try {
      const res = await fetch("/api/settings/ai-brand-fill", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ domain, content_language: settings.content_language }) });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || `HTTP ${res.status}`); }
      const data = await res.json();
      setSettings((prev) => ({
        ...prev,
        brand_name: data.brand_name || prev.brand_name,
        brand_description: data.brand_description || prev.brand_description,
        business_type: data.business_type || prev.business_type,
        target_audience: data.target_audience || prev.target_audience,
        unique_selling_points: data.unique_selling_points || prev.unique_selling_points,
        tone_of_voice: data.tone_of_voice || prev.tone_of_voice,
        language: data.language || prev.language,
        competitors: data.competitors?.length ? data.competitors : prev.competitors,
      }));
    } catch (e) { setAiFillError(e instanceof Error ? e.message : "Could not fetch AI data"); }
    setAiFilling(false);
  };

  const addCompetitor = () => {
    const c = newCompetitor.trim();
    if (c && !settings.competitors.includes(c)) { setSettings((prev) => ({ ...prev, competitors: [...prev.competitors, c] })); setNewCompetitor(""); }
  };
  const removeCompetitor = (c: string) => setSettings((prev) => ({ ...prev, competitors: prev.competitors.filter((x) => x !== c) }));

  const togglePlatform = (p: string) => setSettings((prev) => ({ ...prev, geo_platforms: prev.geo_platforms.includes(p) ? prev.geo_platforms.filter((x) => x !== p) : [...prev.geo_platforms, p] }));

  if (loading) {
    return <CustomerPageShellSkeleton maxWidth="max-w-4xl" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50">
      <CustomerNav />
      <main className="mx-auto max-w-4xl px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-3">
              <Settings className="h-7 w-7 text-slate-400" />
              {t.settings.title}
            </h1>
            <p className="mt-1 text-sm text-slate-500">{t.settings.subtitle}</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => window.location.href = "/c/onboarding?rerun=1"} className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm transition-colors">
              <Rocket className="h-4 w-4" />{t.settings.runOnboarding}
            </button>
            <button onClick={saveSettings} disabled={saving} className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-300 shadow-sm transition-colors">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? t.common.saving : t.common.save}
            </button>
          </div>
        </div>

        {saved && <div className="mb-6 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800"><CheckCircle className="h-4 w-4" /> {t.settings.saved}</div>}
        {error && <div className="mb-6 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"><AlertCircle className="h-4 w-4" /> {error}</div>}
        {successMessage && (
          <div className="mb-6 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <div className="flex items-center gap-2"><CheckCircle className="h-4 w-4" /> {successMessage}</div>
            <button onClick={() => setSuccessMessage("")} className="text-emerald-600 hover:text-emerald-800"><X className="h-4 w-4" /></button>
          </div>
        )}
        {googleError && (
          <div className="mb-6 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <div className="flex items-center gap-2"><AlertCircle className="h-4 w-4" /> {googleError}</div>
            <button onClick={() => setGoogleError("")} className="text-red-600 hover:text-red-800"><X className="h-4 w-4" /></button>
          </div>
        )}

        <IntegrationStatusSummary gsc={googleStatus.search_console} analytics={googleStatus.analytics} ads={googleStatus.ads} github={ghStatus.connected} />

        <div className="space-y-8">
          {/* ── SAMA Agenter ── */}
          <Section icon={Activity} title={t.settings.agentsTitle} desc={t.settings.agentsDesc}>
            {agentsLoading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
            ) : (
              <>
                <div className="space-y-0 rounded-lg border border-slate-200 overflow-hidden">
                  {(agents.length > 0 ? agents : ALL_AGENT_DEFAULTS).filter((a) => ACTIVE_AGENTS.has(a.name)).map((agent, idx) => {
                    const info = AGENT_INFO[agent.name] || { label: agent.name, icon: Bot };
                    const Icon = info.icon;
                    const scheduleLabel = agent.schedule === "daily" ? t.settings.scheduleDaily : agent.schedule === "weekly" ? t.settings.scheduleWeekly : t.settings.scheduleManual;
                    const isToggling = togglingAgent === agent.name;
                    const isTriggering = triggeringAgent === agent.name;
                    return (
                      <div key={agent.name} className={`flex items-center justify-between px-4 py-3 bg-white ${idx > 0 ? "border-t border-slate-100" : ""}`}>
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`rounded-lg p-1.5 ${agent.enabled ? "bg-blue-50" : "bg-slate-100"}`}>
                            <Icon className={`h-4 w-4 ${agent.enabled ? "text-blue-500" : "text-slate-400"}`} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-slate-900">{info.label}</span>
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">{scheduleLabel}</span>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {t.settings.lastRun}: {agent.last_run ? new Date(agent.last_run).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : t.settings.neverRun}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                          <button onClick={() => handleToggleAgent(agent.name, !agent.enabled)} disabled={isToggling} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${agent.enabled ? "bg-blue-500" : "bg-slate-300"} ${isToggling ? "opacity-50" : ""}`}>
                            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${agent.enabled ? "translate-x-[18px]" : "translate-x-[3px]"}`} />
                          </button>
                          <button onClick={() => handleTriggerAgent(agent.name)} disabled={isTriggering} className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
                            {isTriggering ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                            {t.common.run}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {agentRuns.length > 0 && (
                  <div className="mt-5">
                    <h3 className="text-sm font-medium text-slate-700 mb-2">{t.settings.recentRuns}</h3>
                    <div className="rounded-lg border border-slate-200 overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-slate-50 text-slate-500">
                            <th className="text-left px-3 py-2 font-medium">{t.settings.colAgent}</th>
                            <th className="text-left px-3 py-2 font-medium">{t.settings.colTime}</th>
                            <th className="text-left px-3 py-2 font-medium">{t.settings.colStatus}</th>
                            <th className="text-left px-3 py-2 font-medium">{t.settings.colResult}</th>
                            <th className="text-left px-3 py-2 font-medium w-24">{t.settings.colAction}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {agentRuns.slice(0, 10).map((run) => {
                            const isFailed = run.status === "failed";
                            const isRetrying = triggeringAgent === run.agent_name;
                            return (
                              <tr key={run.id} className={`border-t border-slate-100 ${isFailed ? "bg-red-50/40" : ""}`}>
                                <td className="px-3 py-2 font-medium text-slate-700 capitalize">{run.agent_name}</td>
                                <td className="px-3 py-2 text-slate-500">{new Date(run.started_at).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                                <td className="px-3 py-2">
                                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${run.status === "completed" ? "bg-green-100 text-green-700" : isFailed ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>
                                    {run.status === "completed" ? <CheckCircle className="h-2.5 w-2.5" /> : null}
                                    {isFailed ? <AlertCircle className="h-2.5 w-2.5" /> : null}
                                    {run.status === "completed" ? t.settings.runCompleted : isFailed ? t.settings.runFailed : t.settings.runRunning}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-slate-500 truncate max-w-[240px]" title={run.summary || ""}>
                                  {isFailed ? <span className="text-red-700">{run.summary || t.settings.runFailedSummary}</span> : run.summary || "-"}
                                </td>
                                <td className="px-3 py-2">
                                  {isFailed ? (
                                    <button onClick={() => handleTriggerAgent(run.agent_name)} disabled={isRetrying} className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-white px-2 py-0.5 text-[10px] font-medium text-red-700 hover:bg-red-50 transition-colors disabled:opacity-50">
                                      {isRetrying ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Play className="h-2.5 w-2.5" />}
                                      {t.settings.retryRun}
                                    </button>
                                  ) : null}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {agentRuns.length === 0 && (
                  <div className="mt-5">
                    {activationResult ? (
                      <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                        <CheckCircle className="h-4 w-4 flex-shrink-0" />
                        <span>SAMA is activated! {activationResult.keywords_added} keywords added, {activationResult.content_created} content drafts created.</span>
                      </div>
                    ) : (
                      <button onClick={handleActivate} disabled={activating} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 px-5 py-3 text-sm font-semibold text-white hover:from-blue-700 hover:to-violet-700 disabled:opacity-60 shadow-sm transition-all w-full justify-center">
                        {activating ? <><Loader2 className="h-4 w-4 animate-spin" />{t.settings.configuringAgents}</> : <><Zap className="h-4 w-4" />{t.settings.activateSama}</>}
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </Section>

          {/* ── AI Platform Access (managed) ── */}
          <Section icon={Key} title={t.settings.aiServicesTitle} desc={t.settings.aiServicesDesc}>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 flex-shrink-0 text-emerald-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-emerald-900">{t.settings.aiManagedTitle}</p>
                  <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                    {t.settings.aiManagedDesc}{" "}
                    <a href="/c/settings/billing" className="font-medium underline hover:text-emerald-900">{t.settings.aiManagedPlan}</a>.
                  </p>
                </div>
              </div>
            </div>
          </Section>

          {/* ── Brand ── */}
          <Section icon={Globe} title={t.settings.brandTitle} desc={t.settings.brandDesc}>
            <div className="grid gap-4 sm:grid-cols-2">
              <InputField label={t.settings.brandName} value={settings.brand_name} onChange={(v) => updateField("brand_name", v)} placeholder="Acme AB" />
              <InputField label={t.settings.domain} value={settings.domain} onChange={(v) => updateField("domain", v)} placeholder="acme.se" />
              <InputField label={t.settings.country} value={settings.country} onChange={(v) => updateField("country", v)} placeholder="SE" />
              <InputField label={t.settings.language} value={settings.language} onChange={(v) => updateField("language", v)} placeholder="sv" />
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button type="button" onClick={handleAiFill} disabled={aiFilling || !settings.domain.trim()} className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm" title={!settings.domain.trim() ? t.settings.aiFillDomainRequired : t.settings.aiFillAll}>
                {aiFilling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {aiFilling ? t.settings.analyzing : t.settings.fillWithAi}
              </button>
              <p className="text-xs text-slate-400">{t.settings.aiFillDesc}</p>
            </div>
            {aiFillError && <div className="mt-2 flex items-center gap-2 text-sm text-red-600"><AlertCircle className="h-4 w-4 flex-shrink-0" />{aiFillError}</div>}
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t.settings.contentLanguage}</label>
                <select value={settings.content_language || "sv"} onChange={(e) => updateField("content_language", e.target.value)} className="w-full sm:w-64 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
                  {CONTENT_LANGUAGES.map((lang) => <option key={lang.code} value={lang.code}>{lang.label}</option>)}
                </select>
                <p className="text-xs text-slate-400 mt-1">{t.settings.contentLanguageDesc}</p>
              </div>
              <TextareaField label={t.settings.description} value={settings.brand_description} onChange={(v) => updateField("brand_description", v)} placeholder={"Short description of what you do…"} />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t.settings.businessType}</label>
                <select value={settings.business_type} onChange={(e) => updateField("business_type", e.target.value)} className="w-full sm:w-64 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
                  <option value="">{t.settings.selectType}</option>
                  {BUSINESS_TYPES.map((b) => <option key={b.code} value={b.code}>{b.label}</option>)}
                </select>
                <p className="text-xs text-slate-400 mt-1">{t.settings.businessTypeDesc}</p>
              </div>
              <TextareaField label={t.settings.targetAudience} value={settings.target_audience} onChange={(v) => updateField("target_audience", v)} placeholder={"Local SMBs, e-commerce stores…"} />
              <TextareaField label={t.settings.uniqueSelling} value={settings.unique_selling_points} onChange={(v) => updateField("unique_selling_points", v)} placeholder={"Personal service, local presence…"} />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t.settings.toneOfVoice}</label>
                <select value={settings.tone_of_voice} onChange={(e) => updateField("tone_of_voice", e.target.value)} className="w-full sm:w-64 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
                  <option value="professional">{t.settings.toneProfessional}</option>
                  <option value="casual">{t.settings.toneCasual}</option>
                  <option value="technical">{t.settings.toneTechnical}</option>
                  <option value="friendly">{t.settings.toneFriendly}</option>
                  <option value="bold">{t.settings.toneBold}</option>
                </select>
              </div>
            </div>
          </Section>

          {/* ── Competitors ── */}
          <Section icon={Users} title={t.settings.competitorsTitle} desc={t.settings.competitorsDesc}>
            <div className="flex gap-2 mb-3">
              <input type="text" value={newCompetitor} onChange={(e) => setNewCompetitor(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCompetitor())} placeholder={t.settings.addCompetitor} className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              <button onClick={addCompetitor} className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 transition-colors"><Plus className="h-4 w-4" /></button>
            </div>
            <div className="flex flex-wrap gap-2">
              {settings.competitors.length === 0 && <p className="text-sm text-slate-400">{t.settings.noCompetitors}</p>}
              {settings.competitors.map((c) => (
                <span key={c} className="flex items-center gap-1.5 rounded-full bg-orange-100 px-3 py-1 text-sm font-medium text-orange-800 border border-orange-200">
                  {c}<button onClick={() => removeCompetitor(c)} className="hover:text-red-600"><X className="h-3 w-3" /></button>
                </span>
              ))}
            </div>
          </Section>

          {/* ── Local market ── */}
          <Section icon={MapPin} title="Lokal marknad" desc="Fysiska platser för lokal SEO — genererar stadsspecifika nyckelord, innehåll och LocalBusiness-schema.">
            <LocalMarketEditor
              locations={settings.target_locations ?? []}
              onChange={(locs) => setSettings((prev) => ({ ...prev, target_locations: locs }))}
            />
          </Section>

          {/* ── Team members ── */}
          <Section icon={Users} title={t.settings.teamTitle} desc="Invite colleagues to the account — they get access to the same sites, integrations and reports.">
            <TeamManagementPanel compact />
          </Section>

          {/* ── AI Platforms ── */}
          <Section icon={Bot} title={t.settings.aiPlatformsTitle} desc={t.settings.aiPlatformsDesc}>
            <div className="flex flex-wrap gap-3">
              {AVAILABLE_PLATFORMS.map((p) => {
                const active = settings.geo_platforms.includes(p);
                return (
                  <button key={p} onClick={() => togglePlatform(p)} className={`rounded-lg border-2 px-4 py-2.5 text-sm font-medium transition-all ${active ? "border-violet-500 bg-violet-100 text-violet-800 shadow-sm ring-1 ring-violet-200" : "border-slate-200 bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600"}`}>
                    {active && <span className="mr-1.5">&#10003;</span>}{p}
                  </button>
                );
              })}
            </div>
          </Section>

          {/* ── Image Provider ── */}
          <Section icon={Image} title="Bildleverantör" desc="Välj varifrån SAMA hämtar bilder när artiklar genereras automatiskt.">
            <div className="grid gap-3 sm:grid-cols-3">
              {IMAGE_PROVIDERS.map((p) => {
                const active = (settings.image_provider || "unsplash") === p.code;
                return (
                  <button
                    key={p.code}
                    onClick={() => updateField("image_provider", p.code)}
                    className={`rounded-xl border-2 p-4 text-left transition-all ${active ? "border-blue-500 bg-blue-50 shadow-sm ring-1 ring-blue-200" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"}`}
                  >
                    <div className={`text-sm font-semibold mb-1 ${active ? "text-blue-800" : "text-slate-900"}`}>{p.label}</div>
                    <div className={`text-xs leading-relaxed ${active ? "text-blue-600" : "text-slate-500"}`}>{p.desc}</div>
                    {active && <div className="mt-2 text-[10px] font-medium text-blue-500 uppercase tracking-wide">Aktiv</div>}
                  </button>
                );
              })}
            </div>
          </Section>

          {/* ── Google Integrations ── */}
          <Section id="google-integrations" icon={Globe} title={t.settings.googleTitle} desc={t.settings.googleDesc}>
            <div className="space-y-4">
              {GOOGLE_SERVICES.map(({ key, label, icon: ServiceIcon, description }) => {
                const connected = googleStatus[key];
                const isLoading = googleLoading === key;
                const accountEmail = googleEmails[key];
                return (
                  <div key={key} className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`rounded-lg p-2 ${connected ? "bg-emerald-50" : "bg-slate-100"}`}><ServiceIcon className={`h-5 w-5 ${connected ? "text-emerald-500" : "text-slate-400"}`} /></div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-medium text-slate-900">{label}</h4>
                          <p className="text-xs text-slate-500 mt-0.5">{description}</p>
                          {connected && accountEmail && <p className="text-[11px] text-slate-500 mt-1 truncate">Ansluten som <span className="font-mono text-slate-700">{accountEmail}</span></p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                        {connected ? (
                          <>
                            <span className="flex items-center gap-1 text-xs font-medium text-emerald-600"><CheckCircle className="h-3.5 w-3.5" /> {t.common.connected}</span>
                            <button onClick={() => connectGoogle(key)} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors" title={t.settings.switchAccount}><RefreshCw className="h-3 w-3" />{t.settings.switchAccount}</button>
                            <button onClick={() => disconnectGoogle(key)} disabled={isLoading} className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50">{isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Unplug className="h-3 w-3" />}{t.common.disconnect}</button>
                          </>
                        ) : (
                          <button onClick={() => connectGoogle(key)} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors"><ExternalLink className="h-3 w-3" />{t.common.connect}</button>
                        )}
                      </div>
                    </div>
                    {key === "analytics" && connected && user && <GoogleAnalyticsPropertyPicker tenantId={effectiveTenantId ?? user.id} />}
                    {key === "search_console" && connected && user && <GoogleSearchConsolePropertyPicker tenantId={effectiveTenantId ?? user.id} />}
                  </div>
                );
              })}
            </div>
          </Section>

          {/* ── Publishing / GitHub ── */}
          <Section id="publishing" icon={Code2} title={t.settings.publishingTitle} desc={t.settings.publishingDesc}>
            <div className="rounded-lg bg-blue-50 border border-blue-100 p-4 mb-6">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-blue-800 space-y-1">
                  <p className="font-medium text-sm text-blue-900 mb-1">{t.settings.howPublishingWorks}</p>
                  <ol className="list-decimal list-inside space-y-0.5">
                    <li>{t.settings.publishStep1}</li>
                    <li>{t.settings.publishStep2}</li>
                    <li>{t.settings.publishStep3}</li>
                    <li>{t.settings.publishStep4}</li>
                  </ol>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white overflow-hidden mb-4">
              <div className="flex items-center justify-between px-4 py-4">
                <div className="flex items-center gap-3">
                  <div className={`rounded-lg p-2 ${ghStatus.connected ? "bg-emerald-50" : "bg-slate-100"}`}><Code2 className={`h-5 w-5 ${ghStatus.connected ? "text-emerald-500" : "text-slate-400"}`} /></div>
                  <div>
                    <h4 className="text-sm font-medium text-slate-900">{t.settings.githubConnection}</h4>
                    <p className={`text-xs mt-0.5 ${ghStatus.connected ? "text-emerald-600" : "text-slate-400"}`}>{ghLoading ? t.common.loading : ghStatus.connected ? `${t.settings.connectedTo} ${ghStatus.repo}` : t.common.notConnected}</p>
                  </div>
                </div>
                {ghStatus.connected && <span className="flex items-center gap-1 text-xs font-medium text-emerald-600"><CheckCircle className="h-3.5 w-3.5" /> {t.common.connected}</span>}
              </div>
              {ghError && (
                <div className="mx-4 mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="h-3 w-3 flex-shrink-0" />{ghError}
                  <button onClick={() => setGhError("")} className="ml-auto"><X className="h-3 w-3" /></button>
                </div>
              )}
              <div className="border-t border-slate-100 px-4 py-4">
                {ghStatus.connected ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div><span className="text-slate-500 text-xs">{t.settings.repository}</span><p className="font-medium text-slate-900">{ghStatus.repo}</p></div>
                      <div><span className="text-slate-500 text-xs">{t.settings.branch}</span><p className="font-medium text-slate-900">{ghStatus.branch}</p></div>
                      <div><span className="text-slate-500 text-xs">{t.settings.blogPath}</span><p className="font-medium text-slate-900 font-mono text-xs">{ghStatus.blog_path}</p></div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleGhDisconnect} disabled={ghConnecting} className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50">
                        {ghConnecting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Unplug className="h-3 w-3" />}{t.common.disconnect}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {!ghTokenValidated ? (
                      <form onSubmit={(e) => { e.preventDefault(); if (!ghConnecting && ghToken.trim()) handleGhValidateToken(); }}>
                        <input type="text" name="username" autoComplete="username" value="github" readOnly aria-hidden="true" tabIndex={-1} className="hidden" />
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Personal Access Token (PAT)</label>
                          <div className="relative">
                            <input type={ghShowToken ? "text" : "password"} value={ghToken} onChange={(e) => setGhToken(e.target.value)} placeholder="ghp_..." name="github_personal_access_token" autoComplete="new-password" autoCorrect="off" autoCapitalize="off" spellCheck={false} data-1p-ignore data-lpignore="true" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 pr-10 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono" />
                            <button type="button" onClick={() => setGhShowToken(!ghShowToken)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">{ghShowToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                          </div>
                          <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-1.5 text-xs text-blue-600 hover:text-blue-700"><ExternalLink className="h-3 w-3" />{t.settings.createToken}</a>
                        </div>
                        <button type="submit" disabled={ghConnecting || !ghToken.trim()} className="mt-4 flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-300 transition-colors">
                          {ghConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Code2 className="h-4 w-4" />}{t.common.connect}
                        </button>
                      </form>
                    ) : (
                      <>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">{t.settings.selectRepo}</label>
                          {ghReposLoading ? <div className="flex items-center gap-2 text-xs text-slate-400 py-2"><Loader2 className="h-3 w-3 animate-spin" /> {t.settings.fetchingRepos}</div> : (
                            <select value={ghSelectedRepo} onChange={(e) => { setGhSelectedRepo(e.target.value); const repo = ghRepos.find((r) => r.full_name === e.target.value); if (repo) setGhBranch(repo.default_branch); }} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
                              <option value="">-- {"-- " + t.settings.selectRepoPlaceholder + " --"} --</option>
                              {ghRepos.map((r) => <option key={r.full_name} value={r.full_name}>{r.full_name} {r.private ? "(privat)" : ""}</option>)}
                            </select>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">{t.settings.blogPath}</label>
                            <input type="text" value={ghBlogPath} onChange={(e) => setGhBlogPath(e.target.value)} placeholder="content/blog" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">{t.settings.branch}</label>
                            <input type="text" value={ghBranch} onChange={(e) => setGhBranch(e.target.value)} placeholder="main" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono" />
                          </div>
                        </div>
                        <button onClick={handleGhConnect} disabled={ghConnecting || !ghSelectedRepo} className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:bg-emerald-300 transition-colors">
                          {ghConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{t.common.save}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-4">
                <div className="rounded-lg p-2 bg-slate-100"><Link className="h-5 w-5 text-slate-400" /></div>
                <div>
                  <h4 className="text-sm font-medium text-slate-900">{t.settings.blogUrlTitle}</h4>
                  <p className="text-xs text-slate-400 mt-0.5">{t.settings.blogUrlDesc}</p>
                </div>
              </div>
              <div className="border-t border-slate-100 px-4 py-4">
                <div className="flex gap-2">
                  <input type="url" value={blogUrl} onChange={(e) => setBlogUrl(e.target.value)} placeholder="https://exempel.se/blogg" className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  <button onClick={handleSaveBlogUrl} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"><Save className="h-3.5 w-3.5" />{t.common.save}</button>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
              <h4 className="text-sm font-medium text-slate-900 mb-1">{t.settings.emailRecipientTitle}</h4>
              <p className="text-xs text-slate-500 mb-3">{t.settings.emailRecipientDesc}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <InputField label={t.settings.emailAddress} value={settings.publish_email_recipient} onChange={(v) => updateField("publish_email_recipient", v)} placeholder="redaktor@acme.se" />
                <InputField label={t.settings.nameOptional} value={settings.publish_email_recipient_name} onChange={(v) => updateField("publish_email_recipient_name", v)} placeholder="Anna Andersson" />
              </div>
            </div>
          </Section>

          {/* ── CMS Destinations ── */}
          <section id="destinations" className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-1">
              <Globe className="h-5 w-5 text-slate-400" />
              <h2 className="text-lg font-semibold text-slate-900">{t.settings.cmsTitle}</h2>
            </div>
            <p className="text-sm text-slate-500 mb-5 ml-8">{t.settings.cmsDesc}</p>
            <PublishingDestinations />
          </section>

          {/* ── Ad Platforms ── */}
          <Section icon={Megaphone} title={t.settings.adsTitle} desc={t.settings.adsDesc}>
            <div className="space-y-4">
              {([
                { key: "meta", label: "Meta Ads", tokenField: "meta_ads_token" as const, accountField: "meta_ads_account_id" as const, instructions: t.settings.metaInstructions },
                { key: "linkedin", label: "LinkedIn Ads", tokenField: "linkedin_ads_token" as const, accountField: "linkedin_ads_account_id" as const, instructions: t.settings.linkedinInstructions },
                { key: "google", label: "Google Ads", tokenField: "google_ads_token" as const, accountField: "google_ads_account_id" as const, instructions: t.settings.googleAdsInstructions },
              ]).map(({ key, label, tokenField, accountField, instructions }) => {
                const isConnected = !!(settings[tokenField] && settings[accountField]);
                const isExpanded = expandedAdPlatform === key;
                return (
                  <div key={key} className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`rounded-lg p-2 ${isConnected ? "bg-emerald-50" : "bg-slate-100"}`}><Megaphone className={`h-4 w-4 ${isConnected ? "text-emerald-500" : "text-slate-400"}`} /></div>
                        <div>
                          <h4 className="text-sm font-medium text-slate-900">{label}</h4>
                          <p className={`text-xs ${isConnected ? "text-emerald-600" : "text-slate-400"}`}>{isConnected ? t.common.connected : t.common.notConnected}{isConnected && <CheckCircle className="h-3 w-3 inline ml-1" />}</p>
                        </div>
                      </div>
                      <button onClick={() => setExpandedAdPlatform(isExpanded ? null : key)} className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50">{isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</button>
                    </div>
                    {isExpanded && (
                      <div className="border-t border-slate-100 px-4 py-4 space-y-4">
                        {isConnected ? (
                          <>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-sm"><span className="text-slate-500">{t.settings.accessToken}</span><span className="font-mono text-xs text-slate-400">{"*".repeat(8)}…{settings[tokenField].slice(-4)}</span></div>
                              <div className="flex items-center justify-between text-sm"><span className="text-slate-500">{t.settings.accountId}</span><span className="font-mono text-xs text-slate-400">{settings[accountField]}</span></div>
                            </div>
                            <button onClick={() => setSettings((prev) => ({ ...prev, [tokenField]: "", [accountField]: "" }))} className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors"><Unplug className="h-3.5 w-3.5" /> {t.common.disconnect}</button>
                          </>
                        ) : (
                          <>
                            <div className="rounded-lg bg-blue-50 border border-blue-100 p-3">
                              <p className="text-xs font-medium text-blue-800 mb-2">{t.settings.howToConnect}</p>
                              <ol className="space-y-1 list-decimal list-inside text-xs text-blue-700">{instructions.map((step, i) => <li key={i}>{step}</li>)}</ol>
                            </div>
                            <div className="space-y-3">
                              <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">{t.settings.accessToken}</label>
                                <input type="password" value={settings[tokenField]} onChange={(e) => updateField(tokenField, e.target.value)} placeholder={t.settings.pasteToken} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono" />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">{t.settings.accountId}</label>
                                <input type="text" value={settings[accountField]} onChange={(e) => updateField(accountField, e.target.value)} placeholder={t.settings.pasteAccountId} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono" />
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Section>
        </div>
      </main>
    </div>
  );
}

function Section({ icon: Icon, title, desc, children, id }: { icon: React.ElementType; title: string; desc: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="rounded-xl border bg-white p-6 shadow-sm scroll-mt-20">
      <div className="flex items-center gap-3 mb-1"><Icon className="h-5 w-5 text-slate-400" /><h2 className="text-lg font-semibold text-slate-900">{title}</h2></div>
      <p className="text-sm text-slate-500 mb-5 ml-8">{desc}</p>
      {children}
    </section>
  );
}

function InputField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
    </div>
  );
}

function TextareaField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y" />
    </div>
  );
}

function IntegrationStatusSummary({ gsc, analytics, ads, github }: { gsc: boolean; analytics: boolean; ads: boolean; github: boolean }) {
  const { t } = useLanguage();
  type Tone = "ok" | "warn" | "off";
  const items: { label: string; tone: Tone; status: string; fix?: string; anchor: string }[] = [
    { label: "Google Search Console", tone: gsc ? "ok" : "off", status: gsc ? t.settings.intGscConnected : t.settings.intGscOff, fix: gsc ? undefined : t.settings.intGscFix, anchor: "google-integrations" },
    { label: "Google Analytics", tone: analytics ? "ok" : "warn", status: analytics ? t.settings.intGaConnected : t.settings.intGaOptional, fix: analytics ? undefined : t.settings.intGaFix, anchor: "google-integrations" },
    { label: "Google Ads", tone: ads ? "ok" : "warn", status: ads ? t.settings.intGadsConnected : t.settings.intGadsOptional, fix: ads ? undefined : t.settings.intGadsFix, anchor: "google-integrations" },
    { label: "GitHub (publishing)", tone: github ? "ok" : "off", status: github ? t.settings.intGhConnected : t.settings.intGhOff, fix: github ? undefined : t.settings.intGhFix, anchor: "publishing" },
  ];
  const toneClass: Record<Tone, string> = { ok: "bg-emerald-500", warn: "bg-amber-400", off: "bg-red-500" };
  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t.settings.integrationsTitle}</h2>
      <ul className="mt-2 grid gap-2 sm:grid-cols-2">
        {items.map((it) => (
          <li key={it.label} className="flex items-start gap-2 rounded-lg border border-slate-100 bg-slate-50/40 px-3 py-2">
            <span className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${toneClass[it.tone]}`} aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-slate-900">{it.label}</span>
                <a href={`#${it.anchor}`} className="text-[11px] font-medium text-slate-500 hover:text-slate-800">{it.tone === "ok" ? t.settings.intManage : t.settings.intFix}</a>
              </div>
              <p className="text-xs text-slate-500">{it.status}{it.fix && <> — {it.fix}</>}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
