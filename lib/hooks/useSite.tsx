"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { tenantApi } from "@/lib/api";
import { useUser } from "@/lib/hooks/useUser";

export interface UserSite {
  id: string;
  user_id: string;
  site_name: string;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface ViewAs {
  userId: string;
  tenantId: string;
  brandName: string;
  domain: string;
}

interface SiteContextValue {
  sites: UserSite[];
  activeSite: UserSite | null;
  loading: boolean;
  setActiveSiteId: (id: string) => void;
  // Returns a tenant API client scoped to the active site (or view-as target).
  tenantClient: ReturnType<typeof tenantApi>;
  // The resolved tenant ID used by tenantClient (activeSite.id or user.id fallback).
  effectiveTenantId: string;
  // Admin view-as
  viewAs: ViewAs | null;
  setViewAs: (v: ViewAs) => void;
  clearViewAs: () => void;
  // Reload sites from Supabase (e.g. after adding/updating a site).
  reloadSites: () => Promise<void>;
}

const VIEW_AS_KEY = "sama_admin_view_as";
const ACTIVE_SITE_KEY = "sama_active_site_id";

const SiteContext = createContext<SiteContextValue | null>(null);
SiteContext.displayName = "SiteContext";

export function SiteProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const [sites, setSites] = useState<UserSite[]>([]);
  const [activeSiteId, setActiveSiteIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewAs, setViewAsState] = useState<ViewAs | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = sessionStorage.getItem(VIEW_AS_KEY);
      return raw ? (JSON.parse(raw) as ViewAs) : null;
    } catch {
      return null;
    }
  });

  const loadSites = useCallback(async () => {
    if (!user) {
      setSites([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const supabase = getSupabaseBrowser();

    let { data, error } = await supabase
      .from("user_sites")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[useSite] failed to load user_sites:", error);
      setLoading(false);
      return;
    }

    // Auto-migrate from user_settings if no sites exist yet.
    if (!data || data.length === 0) {
      const { data: legacyRow } = await supabase
        .from("user_settings")
        .select("settings")
        .eq("user_id", user.id)
        .single();

      if (legacyRow?.settings) {
        const s = legacyRow.settings as Record<string, unknown>;
        const { error: insertError } = await supabase.from("user_sites").insert({
          id: user.id,
          user_id: user.id,
          site_name: (s.brand_name as string) || "Webbsida 1",
          settings: s,
        });
        if (!insertError) {
          const { data: fresh } = await supabase
            .from("user_sites")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: true });
          data = fresh;
        }
      }
    }

    const loaded = (data ?? []) as UserSite[];
    setSites(loaded);

    // Restore previously chosen site from localStorage, or default to first.
    const stored = typeof window !== "undefined"
      ? localStorage.getItem(ACTIVE_SITE_KEY)
      : null;
    const valid = stored && loaded.some((s) => s.id === stored);
    setActiveSiteIdState(valid ? stored : (loaded[0]?.id ?? null));

    setLoading(false);
  }, [user]);

  useEffect(() => {
    void loadSites();
  }, [loadSites]);

  const setActiveSiteId = useCallback((id: string) => {
    setActiveSiteIdState(id);
    try {
      localStorage.setItem(ACTIVE_SITE_KEY, id);
    } catch { /* ignore */ }
  }, []);

  const setViewAs = useCallback((v: ViewAs) => {
    setViewAsState(v);
    try {
      sessionStorage.setItem(VIEW_AS_KEY, JSON.stringify(v));
    } catch { /* ignore */ }
  }, []);

  const clearViewAs = useCallback(() => {
    setViewAsState(null);
    try {
      sessionStorage.removeItem(VIEW_AS_KEY);
    } catch { /* ignore */ }
  }, []);

  const activeSite = useMemo(
    () => sites.find((s) => s.id === activeSiteId) ?? sites[0] ?? null,
    [sites, activeSiteId]
  );

  // The effective tenant ID: admin view-as overrides the active site.
  const effectiveTenantId = viewAs?.tenantId ?? activeSite?.id ?? user?.id ?? "";

  const tenantClient = useMemo(
    () => tenantApi(effectiveTenantId),
    [effectiveTenantId]
  );

  const value = useMemo<SiteContextValue>(
    () => ({
      sites,
      activeSite,
      loading,
      setActiveSiteId,
      tenantClient,
      effectiveTenantId,
      viewAs,
      setViewAs,
      clearViewAs,
      reloadSites: loadSites,
    }),
    [sites, activeSite, loading, setActiveSiteId, tenantClient, effectiveTenantId, viewAs, setViewAs, clearViewAs, loadSites]
  );

  return (
    <SiteContext.Provider value={value}>{children}</SiteContext.Provider>
  );
}

export function useSite(): SiteContextValue {
  const ctx = useContext(SiteContext);
  if (!ctx) throw new Error("useSite must be used inside <SiteProvider>");
  return ctx;
}
