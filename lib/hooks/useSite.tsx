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

export type AccountRole = "owner" | "admin" | "member";

export interface AccessibleAccount {
  account_id: string;
  role: AccountRole;
  brand_name: string | null;
  domain: string | null;
  owner_email: string | null;
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
  // The owner user_id whose sites we're viewing (account owner, view-as target, or self).
  // Use this when inserting/updating rows scoped by user_id (e.g. user_sites).
  effectiveOwnerId: string;
  // Admin view-as
  viewAs: ViewAs | null;
  setViewAs: (v: ViewAs) => void;
  clearViewAs: () => void;
  // Reload sites from Supabase (e.g. after adding/updating a site).
  reloadSites: () => Promise<void>;

  // Multi-user accounts
  accounts: AccessibleAccount[];
  activeAccountId: string;
  setActiveAccountId: (id: string) => void;
  myRole: AccountRole | null;
  reloadAccounts: () => Promise<void>;
}

const VIEW_AS_KEY = "sama_admin_view_as";
const ACTIVE_SITE_KEY = "sama_active_site_id";
const ACTIVE_ACCOUNT_KEY = "sama_active_account_id";

const SiteContext = createContext<SiteContextValue | null>(null);
SiteContext.displayName = "SiteContext";

export function SiteProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const [sites, setSites] = useState<UserSite[]>([]);
  const [activeSiteId, setActiveSiteIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [accounts, setAccounts] = useState<AccessibleAccount[]>([]);
  const [activeAccountId, setActiveAccountIdState] = useState<string>("");

  const [viewAs, setViewAsState] = useState<ViewAs | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = sessionStorage.getItem(VIEW_AS_KEY);
      return raw ? (JSON.parse(raw) as ViewAs) : null;
    } catch {
      return null;
    }
  });

  // Load (and reconcile) the accounts the user has access to.
  const loadAccounts = useCallback(async () => {
    if (!user) {
      setAccounts([]);
      setActiveAccountIdState("");
      return;
    }
    try {
      // First call accept-invite to activate any pending memberships, then
      // list accessible accounts.
      await fetch("/api/account/accept-invite", { method: "POST" }).catch(() => null);
      const res = await fetch("/api/account/list", { cache: "no-store" });
      if (!res.ok) return;
      const body = (await res.json()) as { accounts: AccessibleAccount[] };
      setAccounts(body.accounts);

      const stored =
        typeof window !== "undefined" ? localStorage.getItem(ACTIVE_ACCOUNT_KEY) : null;
      const valid = stored && body.accounts.some((a) => a.account_id === stored);
      const fallback =
        body.accounts.find((a) => a.account_id === user.id)?.account_id ??
        body.accounts[0]?.account_id ??
        user.id;
      setActiveAccountIdState(valid ? stored : fallback);
    } catch (err) {
      console.error("[useSite] failed to load accounts:", err);
    }
  }, [user]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  // Effective owner whose sites we should load. Admin view-as overrides;
  // otherwise the active account.
  const effectiveOwnerId = viewAs?.userId ?? activeAccountId ?? user?.id ?? "";

  const loadSites = useCallback(async () => {
    if (!effectiveOwnerId) {
      setSites([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    // When in view-as mode, load the viewed tenant's sites via admin API.
    // Direct Supabase query would only return admin's own sites (RLS scoped to auth.uid()).
    if (viewAs) {
      try {
        const res = await fetch(`/api/admin/user-sites/${viewAs.userId}`);
        if (res.ok) {
          const body = await res.json() as { sites: UserSite[] };
          const loaded = body.sites ?? [];
          setSites(loaded);
          setActiveSiteIdState(loaded[0]?.id ?? null);
        } else {
          setSites([]);
        }
      } catch (e) {
        console.error("[useSite] failed to load view-as sites:", e);
        setSites([]);
      }
      setLoading(false);
      return;
    }

    const supabase = getSupabaseBrowser();

    let { data, error } = await supabase
      .from("user_sites")
      .select("*")
      .eq("user_id", effectiveOwnerId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[useSite] failed to load user_sites:", error);
      setLoading(false);
      return;
    }

    // Auto-migrate from user_settings if no sites exist yet (only when looking
    // at the user's own account — never invent sites for an account they joined).
    if ((!data || data.length === 0) && effectiveOwnerId === user?.id) {
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
  }, [effectiveOwnerId, viewAs, user]);

  useEffect(() => {
    void loadSites();
  }, [loadSites]);

  const setActiveSiteId = useCallback((id: string) => {
    setActiveSiteIdState(id);
    try {
      localStorage.setItem(ACTIVE_SITE_KEY, id);
    } catch { /* ignore */ }
  }, []);

  const setActiveAccountId = useCallback((id: string) => {
    setActiveAccountIdState(id);
    try {
      localStorage.setItem(ACTIVE_ACCOUNT_KEY, id);
      // Reset site selection so we don't carry over the previous account's site.
      localStorage.removeItem(ACTIVE_SITE_KEY);
    } catch { /* ignore */ }
    setActiveSiteIdState(null);
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
  const effectiveTenantId = viewAs?.tenantId ?? activeSite?.id ?? effectiveOwnerId;

  const tenantClient = useMemo(
    () => tenantApi(effectiveTenantId),
    [effectiveTenantId]
  );

  const myRole = useMemo<AccountRole | null>(() => {
    if (!activeAccountId) return null;
    return accounts.find((a) => a.account_id === activeAccountId)?.role ?? null;
  }, [accounts, activeAccountId]);

  const value = useMemo<SiteContextValue>(
    () => ({
      sites,
      activeSite,
      loading,
      setActiveSiteId,
      tenantClient,
      effectiveTenantId,
      effectiveOwnerId,
      viewAs,
      setViewAs,
      clearViewAs,
      reloadSites: loadSites,
      accounts,
      activeAccountId,
      setActiveAccountId,
      myRole,
      reloadAccounts: loadAccounts,
    }),
    [
      sites, activeSite, loading, setActiveSiteId, tenantClient, effectiveTenantId,
      effectiveOwnerId, viewAs, setViewAs, clearViewAs, loadSites,
      accounts, activeAccountId, setActiveAccountId, myRole, loadAccounts,
    ]
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
