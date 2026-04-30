"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Settings, Key, Globe, Users, Search, Bot, Save, CheckCircle,
  AlertCircle, Eye, EyeOff, Plus, X, Loader2, Megaphone,
  ChevronDown, ChevronUp, Unplug, BarChart2, ExternalLink, Rocket,
  Play, Power, Clock, Activity, Zap, Code2, Link, Info, Star,
} from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";
import { useUser } from "@/lib/hooks/useUser";

function getSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );
}
import { api, tenantApi, pollAgentRun } from "@/lib/api";
import CustomerNav from "@/components/CustomerNav";

interface UserSettings {
  openai_api_key: string;
  anthropic_api_key: string;
  perplexity_api_key: string;
  google_api_key: string;
  brand_name: string;
  domain: string;
  country: string;
  language: string;
  content_language: string;
  brand_description: string;
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

const DEFAULT_SETTINGS: UserSettings = {
  openai_api_key: "",
  anthropic_api_key: "",
  perplexity_api_key: "",
  google_api_key: "",
  brand_name: "",
  domain: "",
  country: "SE",
  language: "sv",
  content_language: "en",
  brand_description: "",
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
};

const AVAILABLE_PLATFORMS = ["ChatGPT", "Perplexity", "Claude", "Google AIO", "Gemini", "Microsoft Copilot"];

interface GoogleServiceStatus {
  search_console: boolean;
  analytics: boolean;
  ads: boolean;
}

const GOOGLE_SERVICES = [
  {
    key: "search_console" as const,
    label: "Google Search Console",
    icon: Search,
    description: "View search data, clicks and positions from Google",
  },
  {
    key: "analytics" as const,
    label: "Google Analytics (GA4)",
    icon: BarChart2,
    description: "View traffic, conversions and behavior data",
  },
  {
    key: "ads" as const,
    label: "Google Ads",
    icon: Megaphone,
    description: "Manage campaigns and view ad results",
  },
];

const AGENT_INFO: Record<string, { label: string; icon: React.ElementType }> = {
  seo: { label: "SEO Agent", icon: Search },
  content: { label: "Content Agent", icon: Bot },
  social: { label: "Social Agent", icon: Users },
  ads: { label: "Ads Agent", icon: Megaphone },
  reviews: { label: "Reviews Agent", icon: Star },
  analytics: { label: "Analytics Agent", icon: BarChart2 },
  geo: { label: "GEO Monitor", icon: Globe },
};

// Used as fallback when no configs exist yet
const ALL_AGENT_DEFAULTS = [
  { name: "seo", enabled: true, schedule: "daily", last_run: null },
  { name: "content", enabled: true, schedule: "weekly", last_run: null },
  { name: "social", enabled: true, schedule: "daily", last_run: null },
  { name: "ads", enabled: false, schedule: "manual", last_run: null },
  { name: "reviews", enabled: true, schedule: "daily", last_run: null },
  { name: "analytics", enabled: true, schedule: "daily", last_run: null },
  { name: "geo", enabled: true, schedule: "weekly", last_run: null },
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
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [newQuery, setNewQuery] = useState("");
  const [expandedAdPlatform, setExpandedAdPlatform] = useState<string | null>(null);
  const [showAdvancedKeys, setShowAdvancedKeys] = useState(false);
  const [googleStatus, setGoogleStatus] = useState<GoogleServiceStatus>({
    search_console: false,
    analytics: false,
    ads: false,
  });
  const [googleLoading, setGoogleLoading] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [googleError, setGoogleError] = useState("");

  // Agent control state
  interface AgentConfig {
    name: string;
    enabled: boolean;
    schedule: string;
    last_run: string | null;
  }
  interface AgentRun {
    id: string;
    agent_name: string;
    status: string;
    started_at: string;
    completed_at: string | null;
    summary: string | null;
  }
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [agentRuns, setAgentRuns] = useState<AgentRun[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [triggeringAgent, setTriggeringAgent] = useState<string | null>(null);
  const [togglingAgent, setTogglingAgent] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);
  const [activationResult, setActivationResult] = useState<{ keywords_added: number; content_created: number } | null>(null);

  // GitHub integration state
  interface GitHubStatus {
    connected: boolean;
    repo_owner?: string;
    repo_name?: string;
    repo?: string;
    blog_path?: string;
    branch?: string;
    token_masked?: string;
  }
  interface GitHubRepo {
    full_name: string;
    owner: string;
    name: string;
    private: boolean;
    default_branch: string;
  }
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

  useEffect(() => {
    if (user) loadSettings();
  }, [user]);

  useEffect(() => {
    if (error) {
      const t = setTimeout(() => setError(""), 8000);
      return () => clearTimeout(t);
    }
  }, [error]);

  useEffect(() => {
    if (user) loadGoogleStatus();
  }, [user]);

  useEffect(() => {
    if (user) loadAgentStatus();
  }, [user]);

  useEffect(() => {
    if (user) loadGitHubStatus();
  }, [user]);

  const loadGitHubStatus = async () => {
    if (!user) return;
    setGhLoading(true);
    try {
      const client = tenantApi(user.id);
      const data = await client.get<GitHubStatus>("/api/integrations/github/status");
      setGhStatus(data);
      if (data.connected) {
        setGhBlogPath(data.blog_path || "content/blog");
        setGhBranch(data.branch || "main");
      }
    } catch {
      setGhStatus({ connected: false });
    }
    setGhLoading(false);
  };

  const handleGhValidateToken = async () => {
    if (!user || !ghToken.trim()) return;
    setGhConnecting(true);
    setGhError("");
    try {
      const client = tenantApi(user.id);
      await client.post("/api/integrations/github/connect", {
        github_token: ghToken,
      });
      setGhTokenValidated(true);
      // Fetch repos
      setGhReposLoading(true);
      try {
        const repoData = await client.get<{ repos: GitHubRepo[] }>("/api/integrations/github/repos");
        setGhRepos(repoData.repos || []);
      } catch {
        setGhError("Could not fetch repos. Verify your token has repo scope.");
      }
      setGhReposLoading(false);
    } catch (err: any) {
      setGhError(err?.message || "Invalid token");
    }
    setGhConnecting(false);
  };

  const handleGhConnect = async () => {
    if (!user || !ghSelectedRepo) return;
    setGhConnecting(true);
    setGhError("");
    const parts = ghSelectedRepo.split("/");
    const owner = parts[0];
    const name = parts[1];
    try {
      const client = tenantApi(user.id);
      await client.post("/api/integrations/github/connect", {
        github_token: ghToken,
        repo_owner: owner,
        repo_name: name,
        blog_path: ghBlogPath,
        branch: ghBranch,
      });
      await loadGitHubStatus();
      setGhToken("");
      setGhTokenValidated(false);
      setGhRepos([]);
      setSuccessMessage("GitHub connected!");
    } catch (err: any) {
      setGhError(err?.message || "Could not connect");
    }
    setGhConnecting(false);
  };

  const handleGhDisconnect = async () => {
    if (!user) return;
    setGhConnecting(true);
    try {
      const client = tenantApi(user.id);
      await client.post("/api/integrations/github/disconnect", {});
      setGhStatus({ connected: false });
      setGhTokenValidated(false);
      setGhToken("");
      setGhRepos([]);
    } catch {
      setGhError("Could not disconnect");
    }
    setGhConnecting(false);
  };

  const handleSaveBlogUrl = async () => {
    if (!user) return;
    try {
      const currentSettings = { ...settings } as any;
      currentSettings.blog_url = blogUrl;
      const { error: upsertError } = await getSupabase()
        .from("user_settings")
        .upsert({
          user_id: user.id,
          settings: currentSettings,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });
      if (upsertError) throw upsertError;
      setSuccessMessage("Blog URL saved!");
    } catch {
      setError("Could not save blog URL");
    }
  };

  const loadAgentStatus = async () => {
    if (!user) return;
    setAgentsLoading(true);
    try {
      const client = tenantApi(user.id);
      const [statusData, runsData] = await Promise.all([
        client.get<{ agents: AgentConfig[] }>("/api/tenant/agent-status"),
        client.get<{ runs: AgentRun[] }>("/api/tenant/agent-runs?limit=10"),
      ]);
      setAgents(statusData.agents || []);
      setAgentRuns(runsData.runs || []);
    } catch {
      // Agent tables may not exist yet
      setAgents([]);
      setAgentRuns([]);
    }
    setAgentsLoading(false);
  };

  const handleToggleAgent = async (agentName: string, enabled: boolean) => {
    if (!user) return;
    setTogglingAgent(agentName);
    try {
      const client = tenantApi(user.id);
      await client.post(`/api/tenant/agents/${agentName}/toggle`, { enabled });
      setAgents((prev) =>
        prev.map((a) => (a.name === agentName ? { ...a, enabled } : a))
      );
    } catch {
      setError("Could not update agent");
    }
    setTogglingAgent(null);
  };

  const handleTriggerAgent = async (agentName: string) => {
    if (!user) return;
    setTriggeringAgent(agentName);
    try {
      const client = tenantApi(user.id);
      // Trigger is fire-and-forget on the backend: returns run_id while the
      // cycle continues in a background task. We refresh the runs list
      // immediately so the user sees the "Running" row, then poll until it
      // settles to refresh again with the final status.
      const resp = await client.post<{ run_id?: string; status?: string }>(
        `/api/tenant/agents/${agentName}/trigger`,
      );
      await loadAgentStatus();

      if (resp?.run_id && resp?.status === "running") {
        // Poll in background — don't block the spinner on it.
        pollAgentRun(user.id, resp.run_id).then(() => loadAgentStatus()).catch(() => {});
      }
    } catch {
      setError(`Could not run the ${agentName} agent`);
    }
    setTriggeringAgent(null);
  };

  const handleActivate = async () => {
    if (!user) return;
    setActivating(true);
    setActivationResult(null);
    try {
      const client = tenantApi(user.id);
      const result = await client.post<{ keywords_added: number; content_created: number }>("/api/tenant/activate");
      setActivationResult(result);
      await loadAgentStatus();
    } catch {
      setError("Activation failed. Please try again.");
    }
    setActivating(false);
  };

  useEffect(() => {
    if (googleConnected) {
      setSuccessMessage(`${googleConnected} connected!`);
      window.history.replaceState({}, "", "/c/settings");
      loadGoogleStatus();
    }
    if (googleErrorParam) {
      setGoogleError("Could not connect to Google. Please try again.");
      window.history.replaceState({}, "", "/c/settings");
    }
  }, [googleConnected, googleErrorParam]);

  const loadGoogleStatus = async () => {
    if (!user) return;
    try {
      const data = await api.get<Record<string, { connected?: boolean }>>(
        `/api/auth/google/status?tenant_id=${user.id}`
      );
      setGoogleStatus({
        search_console: !!data?.search_console?.connected,
        analytics: !!data?.analytics?.connected,
        ads: !!data?.ads?.connected,
      });
    } catch {
      setGoogleStatus({ search_console: false, analytics: false, ads: false });
    }
  };

  const connectGoogle = (service: string) => {
    if (!user) return;
    window.location.href = `${api.baseUrl}/api/auth/google/connect?service=${service}&tenant_id=${user.id}`;
  };

  const disconnectGoogle = async (service: string) => {
    if (!user) return;
    setGoogleLoading(service);
    try {
      await api.delete(
        `/api/auth/google/disconnect?service=${service}&tenant_id=${user.id}`
      );
      await loadGoogleStatus();
    } catch {
      setGoogleError("Could not disconnect. Please try again.");
    }
    setGoogleLoading(null);
  };

  const loadSettings = async () => {
    if (!user) { setLoading(false); return; }
    try {
      const { data } = await getSupabase()
        .from("user_settings")
        .select("*")
        .eq("user_id", user.id)
        .single();
      if (data?.settings) {
        setSettings({ ...DEFAULT_SETTINGS, ...data.settings });
        if (data.settings.blog_url) setBlogUrl(data.settings.blog_url);
      }
    } catch {
      // First time
    }
    setLoading(false);
  };

  const saveSettings = async () => {
    if (!user) return;
    setSaving(true);
    setError("");
    setSaved(false);

    try {
      const { error: upsertError } = await getSupabase()
        .from("user_settings")
        .upsert({
          user_id: user.id,
          settings,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });

      if (upsertError) throw upsertError;
      setSaved(true);
      setTimeout(() => setSaved(false), 5000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not save");
    }
    setSaving(false);
  };

  const updateField = (field: keyof UserSettings, value: string) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  const addQuery = () => {
    const q = newQuery.trim().replace(/^["'"]+|["'"]+$/g, "");
    if (q && !settings.geo_queries.includes(q)) {
      setSettings((prev) => ({ ...prev, geo_queries: [...prev.geo_queries, q] }));
      setNewQuery("");
    }
  };

  const removeQuery = (q: string) => {
    setSettings((prev) => ({ ...prev, geo_queries: prev.geo_queries.filter((x) => x !== q) }));
  };

  const togglePlatform = (p: string) => {
    setSettings((prev) => ({
      ...prev,
      geo_platforms: prev.geo_platforms.includes(p)
        ? prev.geo_platforms.filter((x) => x !== p)
        : [...prev.geo_platforms, p],
    }));
  };

  const toggleShowKey = (key: string) => {
    setShowKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50">
        <CustomerNav />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50">
      <CustomerNav />

      <main className="mx-auto max-w-4xl px-4 sm:px-6 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-3">
              <Settings className="h-7 w-7 text-slate-400" />
              Settings
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Configure API keys, brand info and GEO monitoring
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.location.href = "/c/onboarding"}
              className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
            >
              <Rocket className="h-4 w-4" />
              Run Onboarding
            </button>
            <button
              onClick={saveSettings}
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-300 shadow-sm transition-colors"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>

        {saved && (
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            <CheckCircle className="h-4 w-4" /> Settings saved!
          </div>
        )}

        {error && (
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <AlertCircle className="h-4 w-4" /> {error}
          </div>
        )}

        {successMessage && (
          <div className="mb-6 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" /> {successMessage}
            </div>
            <button onClick={() => setSuccessMessage("")} className="text-emerald-600 hover:text-emerald-800">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {googleError && (
          <div className="mb-6 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" /> {googleError}
            </div>
            <button onClick={() => setGoogleError("")} className="text-red-600 hover:text-red-800">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="space-y-8">
          {/* ── SAMA Agenter ── */}
          <Section icon={Activity} title="SAMA Agents" desc="Control which agents run and when">
            {agentsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            ) : (
              <>
                <div className="space-y-0 rounded-lg border border-slate-200 overflow-hidden">
                  {(agents.length > 0 ? agents : ALL_AGENT_DEFAULTS).map((agent, idx) => {
                    const info = AGENT_INFO[agent.name] || { label: agent.name, icon: Bot };
                    const Icon = info.icon;
                    const scheduleLabel = agent.schedule === "daily" ? "Daily" : agent.schedule === "weekly" ? "Weekly" : "Manual";
                    const isToggling = togglingAgent === agent.name;
                    const isTriggering = triggeringAgent === agent.name;
                    return (
                      <div
                        key={agent.name}
                        className={`flex items-center justify-between px-4 py-3 bg-white ${idx > 0 ? "border-t border-slate-100" : ""}`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`rounded-lg p-1.5 ${agent.enabled ? "bg-blue-50" : "bg-slate-100"}`}>
                            <Icon className={`h-4 w-4 ${agent.enabled ? "text-blue-500" : "text-slate-400"}`} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-slate-900">{info.label}</span>
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                                {scheduleLabel}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">
                              Last run: {agent.last_run ? new Date(agent.last_run).toLocaleString("en-US", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "Never"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                          <button
                            onClick={() => handleToggleAgent(agent.name, !agent.enabled)}
                            disabled={isToggling}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                              agent.enabled ? "bg-blue-500" : "bg-slate-300"
                            } ${isToggling ? "opacity-50" : ""}`}
                          >
                            <span
                              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                                agent.enabled ? "translate-x-[18px]" : "translate-x-[3px]"
                              }`}
                            />
                          </button>
                          <button
                            onClick={() => handleTriggerAgent(agent.name)}
                            disabled={isTriggering}
                            className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
                          >
                            {isTriggering ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Play className="h-3 w-3" />
                            )}
                            Run
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Recent runs */}
                {agentRuns.length > 0 && (
                  <div className="mt-5">
                    <h3 className="text-sm font-medium text-slate-700 mb-2">Recent Runs</h3>
                    <div className="rounded-lg border border-slate-200 overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-slate-50 text-slate-500">
                            <th className="text-left px-3 py-2 font-medium">Agent</th>
                            <th className="text-left px-3 py-2 font-medium">Time</th>
                            <th className="text-left px-3 py-2 font-medium">Status</th>
                            <th className="text-left px-3 py-2 font-medium">Result</th>
                            <th className="text-left px-3 py-2 font-medium w-24">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {agentRuns.slice(0, 10).map((run) => {
                            const isFailed = run.status === "failed";
                            const isRetrying = triggeringAgent === run.agent_name;
                            return (
                              <tr key={run.id} className={`border-t border-slate-100 ${isFailed ? "bg-red-50/40" : ""}`}>
                                <td className="px-3 py-2 font-medium text-slate-700 capitalize">{run.agent_name}</td>
                                <td className="px-3 py-2 text-slate-500">
                                  {new Date(run.started_at).toLocaleString("en-US", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                                </td>
                                <td className="px-3 py-2">
                                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                    run.status === "completed" ? "bg-green-100 text-green-700" :
                                    isFailed ? "bg-red-100 text-red-700" :
                                    "bg-yellow-100 text-yellow-700"
                                  }`}>
                                    {run.status === "completed" ? <CheckCircle className="h-2.5 w-2.5" /> : null}
                                    {isFailed ? <AlertCircle className="h-2.5 w-2.5" /> : null}
                                    {run.status === "completed" ? "Done" : isFailed ? "Failed" : "Running..."}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-slate-500 truncate max-w-[240px]" title={run.summary || ""}>
                                  {isFailed ? (
                                    <span className="text-red-700">{run.summary || "Run did not complete. Try again or check integrations."}</span>
                                  ) : (
                                    run.summary || "-"
                                  )}
                                </td>
                                <td className="px-3 py-2">
                                  {isFailed ? (
                                    <button
                                      onClick={() => handleTriggerAgent(run.agent_name)}
                                      disabled={isRetrying}
                                      className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-white px-2 py-0.5 text-[10px] font-medium text-red-700 hover:bg-red-50 transition-colors disabled:opacity-50"
                                    >
                                      {isRetrying ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Play className="h-2.5 w-2.5" />}
                                      Re-run
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

                {/* Activate button - shown if no runs have happened */}
                {agentRuns.length === 0 && (
                  <div className="mt-5">
                    {activationResult ? (
                      <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                        <CheckCircle className="h-4 w-4 flex-shrink-0" />
                        <span>
                          SAMA activated! {activationResult.keywords_added} keywords added, {activationResult.content_created} content pieces created.
                        </span>
                      </div>
                    ) : (
                      <button
                        onClick={handleActivate}
                        disabled={activating}
                        className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 px-5 py-3 text-sm font-semibold text-white hover:from-blue-700 hover:to-violet-700 disabled:opacity-60 shadow-sm transition-all w-full justify-center"
                      >
                        {activating ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Configuring your agents...
                          </>
                        ) : (
                          <>
                            <Zap className="h-4 w-4" />
                            Activate SAMA — Run Initial Setup
                          </>
                        )}
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </Section>

          {/* ── AI Platform Access (managed) ── */}
          <Section icon={Key} title="AI Platform Access" desc="LLM and search providers SAMA uses to power your agents">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 flex-shrink-0 text-emerald-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-emerald-900">
                    Managed by SAMA — no setup required
                  </p>
                  <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                    SAMA covers OpenAI, Anthropic, Perplexity and SerpAPI usage as part of your plan.
                    Your monthly token budget scales with your subscription tier — see your{" "}
                    <a href="/c/pricing" className="font-medium underline hover:text-emerald-900">plan</a>{" "}
                    for details.
                  </p>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowAdvancedKeys((v) => !v)}
              className="mt-3 flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
            >
              {showAdvancedKeys ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {showAdvancedKeys ? "Hide" : "Show"} advanced: bring-your-own keys
            </button>
            {showAdvancedKeys && (
              <div className="mt-4 space-y-4">
                <p className="text-xs text-slate-500 leading-relaxed">
                  Optional. Provide your own provider keys to bypass SAMA&apos;s managed quota
                  (Enterprise / dev use only). Leave blank to use SAMA-managed access.
                </p>
                {([
                  { key: "openai", field: "openai_api_key" as const, label: "OpenAI API Key", placeholder: "sk-..." },
                  { key: "anthropic", field: "anthropic_api_key" as const, label: "Anthropic API Key", placeholder: "sk-ant-..." },
                  { key: "perplexity", field: "perplexity_api_key" as const, label: "Perplexity API Key", placeholder: "pplx-..." },
                  { key: "google", field: "google_api_key" as const, label: "SerpAPI Key", placeholder: "..." },
                ]).map(({ key, field, label, placeholder }) => (
                  <div key={key}>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type={showKeys[key] ? "text" : "password"}
                          value={settings[field]}
                          onChange={(e) => updateField(field, e.target.value)}
                          placeholder={placeholder}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 pr-10 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => toggleShowKey(key)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          {showKeys[key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {settings[field] && (
                        <span className="flex items-center rounded-lg bg-green-100 px-2 text-xs font-medium text-green-700 border border-green-200">
                          <CheckCircle className="h-3 w-3 mr-1" /> Override active
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* ── Brand ── */}
          <Section icon={Globe} title="Brand & Domain" desc="Information about your brand for agent context">
            <div className="grid gap-4 sm:grid-cols-2">
              <InputField label="Brand Name" value={settings.brand_name} onChange={(v) => updateField("brand_name", v)} placeholder="Acme Corp" />
              <InputField label="Domain" value={settings.domain} onChange={(v) => updateField("domain", v)} placeholder="acme.com" />
              <InputField label="Country" value={settings.country} onChange={(v) => updateField("country", v)} placeholder="SE" />
              <InputField label="Language" value={settings.language} onChange={(v) => updateField("language", v)} placeholder="en" />
            </div>
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Content Language</label>
                <select
                  value={settings.content_language || "en"}
                  onChange={(e) => updateField("content_language", e.target.value)}
                  className="w-full sm:w-64 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {CONTENT_LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>{lang.label}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-400 mt-1">Language used when SAMA generates content for your brand.</p>
              </div>
              <TextareaField label="Description" value={settings.brand_description} onChange={(v) => updateField("brand_description", v)} placeholder="Short description of what you do..." />
              <TextareaField label="Target Audience" value={settings.target_audience} onChange={(v) => updateField("target_audience", v)} placeholder="B2B SaaS companies with 50-500 employees..." />
              <TextareaField label="Unique Selling Points" value={settings.unique_selling_points} onChange={(v) => updateField("unique_selling_points", v)} placeholder="AI-driven, 10x faster, best in market..." />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tone of Voice</label>
                <select
                  value={settings.tone_of_voice}
                  onChange={(e) => updateField("tone_of_voice", e.target.value)}
                  className="w-full sm:w-64 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="professional">Professional</option>
                  <option value="casual">Casual</option>
                  <option value="technical">Technical</option>
                  <option value="friendly">Friendly</option>
                  <option value="bold">Bold</option>
                </select>
              </div>
            </div>
          </Section>

          {/* ── GEO Queries ── */}
          <Section icon={Search} title="GEO Queries" desc="Questions to ask AI platforms to track your brand">
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={newQuery}
                onChange={(e) => setNewQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addQuery())}
                placeholder='e.g. "best CRM for startups"'
                className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button onClick={addQuery} className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 transition-colors">
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2">
              {settings.geo_queries.length === 0 && <p className="text-sm text-slate-400">No queries added</p>}
              {settings.geo_queries.map((q) => (
                <div key={q} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-2">
                  <span className="text-sm text-slate-700">&ldquo;{q}&rdquo;</span>
                  <button onClick={() => removeQuery(q)} className="text-slate-400 hover:text-red-600"><X className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          </Section>

          {/* ── AI Platforms ── */}
          <Section icon={Bot} title="AI Platforms" desc="Which AI platforms should the GEO agent monitor?">
            <div className="flex flex-wrap gap-3">
              {AVAILABLE_PLATFORMS.map((p) => {
                const active = settings.geo_platforms.includes(p);
                return (
                  <button
                    key={p}
                    onClick={() => togglePlatform(p)}
                    className={`rounded-lg border-2 px-4 py-2.5 text-sm font-medium transition-all ${
                      active
                        ? "border-violet-500 bg-violet-100 text-violet-800 shadow-sm ring-1 ring-violet-200"
                        : "border-slate-200 bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    }`}
                  >
                    {active && <span className="mr-1.5">&#10003;</span>}
                    {p}
                  </button>
                );
              })}
            </div>
          </Section>

          {/* ── Google Integrations ── */}
          <Section icon={Globe} title="Google Integrations" desc="Connect your Google services via OAuth for automatic data sync">
            <div className="space-y-4">
              {GOOGLE_SERVICES.map(({ key, label, icon: ServiceIcon, description }) => {
                const connected = googleStatus[key];
                const isLoading = googleLoading === key;
                return (
                  <div key={key} className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`rounded-lg p-2 ${connected ? "bg-emerald-50" : "bg-slate-100"}`}>
                          <ServiceIcon className={`h-5 w-5 ${connected ? "text-emerald-500" : "text-slate-400"}`} />
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-slate-900">{label}</h4>
                          <p className="text-xs text-slate-500 mt-0.5">{description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                        {connected ? (
                          <>
                            <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                              <CheckCircle className="h-3.5 w-3.5" /> Connected
                            </span>
                            <button
                              onClick={() => disconnectGoogle(key)}
                              disabled={isLoading}
                              className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
                            >
                              {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Unplug className="h-3 w-3" />}
                              Disconnect
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => connectGoogle(key)}
                            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Connect
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>

          {/* ── Publishing / GitHub ── */}
          <Section icon={Code2} title="Publishing" desc="Connect GitHub to publish blog posts as Pull Requests">
            {/* Info box */}
            <div className="rounded-lg bg-blue-50 border border-blue-100 p-4 mb-6">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-blue-800 space-y-1">
                  <p className="font-medium text-sm text-blue-900 mb-1">How publishing works:</p>
                  <ol className="list-decimal list-inside space-y-0.5">
                    <li>SAMA generates blog posts as drafts</li>
                    <li>You review and approve in the Content tab</li>
                    <li>Click &quot;Publish&quot; &rarr; SAMA creates a Pull Request in your GitHub repo</li>
                    <li>Review the PR and merge &rarr; the blog post is live!</li>
                  </ol>
                </div>
              </div>
            </div>

            {/* GitHub connection card */}
            <div className="rounded-lg border border-slate-200 bg-white overflow-hidden mb-4">
              <div className="flex items-center justify-between px-4 py-4">
                <div className="flex items-center gap-3">
                  <div className={`rounded-lg p-2 ${ghStatus.connected ? "bg-emerald-50" : "bg-slate-100"}`}>
                    <Code2 className={`h-5 w-5 ${ghStatus.connected ? "text-emerald-500" : "text-slate-400"}`} />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-slate-900">GitHub Connection</h4>
                    <p className={`text-xs mt-0.5 ${ghStatus.connected ? "text-emerald-600" : "text-slate-400"}`}>
                      {ghLoading ? "Loading..." : ghStatus.connected ? `Connected to ${ghStatus.repo}` : "Not connected"}
                    </p>
                  </div>
                </div>
                {ghStatus.connected && (
                  <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                    <CheckCircle className="h-3.5 w-3.5" /> Connected
                  </span>
                )}
              </div>

              {ghError && (
                <div className="mx-4 mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="h-3 w-3 flex-shrink-0" />
                  {ghError}
                  <button onClick={() => setGhError("")} className="ml-auto"><X className="h-3 w-3" /></button>
                </div>
              )}

              <div className="border-t border-slate-100 px-4 py-4">
                {ghStatus.connected ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-slate-500 text-xs">Repository</span>
                        <p className="font-medium text-slate-900">{ghStatus.repo}</p>
                      </div>
                      <div>
                        <span className="text-slate-500 text-xs">Branch</span>
                        <p className="font-medium text-slate-900">{ghStatus.branch}</p>
                      </div>
                      <div>
                        <span className="text-slate-500 text-xs">Blog Path</span>
                        <p className="font-medium text-slate-900 font-mono text-xs">{ghStatus.blog_path}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleGhDisconnect}
                        disabled={ghConnecting}
                        className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
                      >
                        {ghConnecting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Unplug className="h-3 w-3" />}
                        Disconnect
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {!ghTokenValidated ? (
                      <>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Personal Access Token</label>
                          <div className="relative">
                            <input
                              type={ghShowToken ? "text" : "password"}
                              value={ghToken}
                              onChange={(e) => setGhToken(e.target.value)}
                              placeholder="ghp_..."
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 pr-10 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                            />
                            <button
                              type="button"
                              onClick={() => setGhShowToken(!ghShowToken)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                              {ghShowToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                          <a
                            href="https://github.com/settings/tokens"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 mt-1.5 text-xs text-blue-600 hover:text-blue-700"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Create a token at github.com/settings/tokens (needs repo scope)
                          </a>
                        </div>
                        <button
                          onClick={handleGhValidateToken}
                          disabled={ghConnecting || !ghToken.trim()}
                          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
                        >
                          {ghConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Code2 className="h-4 w-4" />}
                          Connect
                        </button>
                      </>
                    ) : (
                      <>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Select repository</label>
                          {ghReposLoading ? (
                            <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
                              <Loader2 className="h-3 w-3 animate-spin" /> Fetching repos...
                            </div>
                          ) : (
                            <select
                              value={ghSelectedRepo}
                              onChange={(e) => {
                                setGhSelectedRepo(e.target.value);
                                const repo = ghRepos.find((r) => r.full_name === e.target.value);
                                if (repo) setGhBranch(repo.default_branch);
                              }}
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                              <option value="">-- Select repo --</option>
                              {ghRepos.map((r) => (
                                <option key={r.full_name} value={r.full_name}>
                                  {r.full_name} {r.private ? "(private)" : ""}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Blog Path</label>
                            <input
                              type="text"
                              value={ghBlogPath}
                              onChange={(e) => setGhBlogPath(e.target.value)}
                              placeholder="content/blog"
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Branch</label>
                            <input
                              type="text"
                              value={ghBranch}
                              onChange={(e) => setGhBranch(e.target.value)}
                              placeholder="main"
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                            />
                          </div>
                        </div>
                        <button
                          onClick={handleGhConnect}
                          disabled={ghConnecting || !ghSelectedRepo}
                          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:bg-emerald-300 transition-colors"
                        >
                          {ghConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                          Save
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Blog URL card */}
            <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-4">
                <div className="rounded-lg p-2 bg-slate-100">
                  <Link className="h-5 w-5 text-slate-400" />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-slate-900">Blog URL</h4>
                  <p className="text-xs text-slate-400 mt-0.5">URL to your published blog</p>
                </div>
              </div>
              <div className="border-t border-slate-100 px-4 py-4">
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={blogUrl}
                    onChange={(e) => setBlogUrl(e.target.value)}
                    placeholder="https://mybrand.com/blog"
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleSaveBlogUrl}
                    className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                  >
                    <Save className="h-3.5 w-3.5" />
                    Save
                  </button>
                </div>
              </div>
            </div>
          </Section>

          {/* ── Ad Platforms ── */}
          <Section icon={Megaphone} title="Ad Platforms" desc="Connect your ad accounts for automatic sync and analysis">
            <div className="space-y-4">
              {([
                {
                  key: "meta",
                  label: "Meta Ads",
                  tokenField: "meta_ads_token" as const,
                  accountField: "meta_ads_account_id" as const,
                  instructions: [
                    "Go to developers.facebook.com and create an app",
                    "Generate a User Access Token with ads_read permission",
                    "Copy your Ad Account ID from Ads Manager",
                    "Paste both values below",
                  ],
                },
                {
                  key: "linkedin",
                  label: "LinkedIn Ads",
                  tokenField: "linkedin_ads_token" as const,
                  accountField: "linkedin_ads_account_id" as const,
                  instructions: [
                    "Go to linkedin.com/developers and create an app",
                    "Request Marketing Developer Platform access",
                    "Generate an OAuth 2.0 access token",
                    "Get your Sponsored Account ID from Campaign Manager",
                  ],
                },
                {
                  key: "google",
                  label: "Google Ads",
                  tokenField: "google_ads_token" as const,
                  accountField: "google_ads_account_id" as const,
                  instructions: [
                    "Go to console.cloud.google.com and enable Google Ads API",
                    "Create OAuth2 credentials and generate a refresh token",
                    "Get your Customer ID from Google Ads (xxx-xxx-xxxx)",
                    "Paste both values below",
                  ],
                },
              ]).map(({ key, label, tokenField, accountField, instructions }) => {
                const isConnected = !!(settings[tokenField] && settings[accountField]);
                const isExpanded = expandedAdPlatform === key;
                return (
                  <div key={key} className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`rounded-lg p-2 ${isConnected ? "bg-emerald-50" : "bg-slate-100"}`}>
                          <Megaphone className={`h-4 w-4 ${isConnected ? "text-emerald-500" : "text-slate-400"}`} />
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-slate-900">{label}</h4>
                          <p className={`text-xs ${isConnected ? "text-emerald-600" : "text-slate-400"}`}>
                            {isConnected ? "Connected" : "Not connected"}
                            {isConnected && <CheckCircle className="h-3 w-3 inline ml-1" />}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setExpandedAdPlatform(isExpanded ? null : key)}
                        className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                      >
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    </div>
                    {isExpanded && (
                      <div className="border-t border-slate-100 px-4 py-4 space-y-4">
                        {isConnected ? (
                          <>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-500">Access Token</span>
                                <span className="font-mono text-xs text-slate-400">
                                  {"*".repeat(8)}...{settings[tokenField].slice(-4)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-500">Account ID</span>
                                <span className="font-mono text-xs text-slate-400">{settings[accountField]}</span>
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                setSettings((prev) => ({
                                  ...prev,
                                  [tokenField]: "",
                                  [accountField]: "",
                                }));
                              }}
                              className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors"
                            >
                              <Unplug className="h-3.5 w-3.5" /> Disconnect
                            </button>
                          </>
                        ) : (
                          <>
                            {/* Setup instructions */}
                            <div className="rounded-lg bg-blue-50 border border-blue-100 p-3">
                              <p className="text-xs font-medium text-blue-800 mb-2">How to connect:</p>
                              <ol className="space-y-1 list-decimal list-inside text-xs text-blue-700">
                                {instructions.map((step, i) => (
                                  <li key={i}>{step}</li>
                                ))}
                              </ol>
                            </div>
                            <div className="space-y-3">
                              <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Access Token</label>
                                <input
                                  type="password"
                                  value={settings[tokenField]}
                                  onChange={(e) => updateField(tokenField, e.target.value)}
                                  placeholder="Paste your access token..."
                                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Account ID</label>
                                <input
                                  type="text"
                                  value={settings[accountField]}
                                  onChange={(e) => updateField(accountField, e.target.value)}
                                  placeholder="Your account ID..."
                                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                                />
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

function Section({ icon: Icon, title, desc, children }: {
  icon: React.ElementType; title: string; desc: string; children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-1">
        <Icon className="h-5 w-5 text-slate-400" />
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      </div>
      <p className="text-sm text-slate-500 mb-5 ml-8">{desc}</p>
      {children}
    </section>
  );
}

function InputField({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
    </div>
  );
}

function TextareaField({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y"
      />
    </div>
  );
}
