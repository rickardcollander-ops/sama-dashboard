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
import { isAdminEmail } from "@/lib/admin";

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
  // Stays true until the first /api/account/list response arrives.
  // loadSites is gated on this so it never runs with the wrong effectiveOwnerId
  // (user's own id instead of the account owner's id for invited members).
  const [accountsLoading, setAccountsLoading] = useState(true);

  const [viewAs, setViewAsState] = useState<ViewAs | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = sessionStorage.getItem(VIEW_AS_KEY);
      return raw ? (JSON.parse(raw) as ViewAs) : null;
    } catch {
      return null;
    }
  });

  // Stable primitive deps — prevents hooks from being recreated on every
  // TOKEN_REFRESHED event (new User object reference, same id) which would
  // otherwise trigger cascading re-renders and extra API calls per hourly refresh.
  const userId = user?.id ?? "";
  const userEmail = user?.email ?? "";

  // sessionStorage survives sign-out/sign-in within the same tab. If a
  // non-admin lands on the dashboard with a stale view-as left over from
  // a previous admin session, every request will be tagged with the wrong
  // account and /api/admin/* will 401/403 — and AdminViewBanner is hidden
  // for non-admins, so they have no way to clear it. Drop it as soon as we
  // know who's logged in.
  useEffect(() => {
    if (!userId) return;
    if (isAdminEmail(userEmail)) return;
    if (typeof window === "undefined") return;
    if (!sessionStorage.getItem(VIEW_AS_KEY)) return;
    try {
      sessionStorage.removeItem(VIEW_AS_KEY);
    } catch { /* ignore */ }
    setViewAsState(null);
  }, [userId, userEmail]);

  // Load (and reconcile) the accounts the user has access to.
  const loadAccounts = useCallback(async () => {
    if (!userId) {
      setAccounts([]);
      setActiveAccountIdState("");
      setAccountsLoading(false);
      return;
    }
    try {
      // Fire accept-invite alongside list instead of in front of it.
      const [, res] = await Promise.all([
        fetch("/api/account/accept-invite", { method: "POST" }).catch(() => null),
        fetch("/api/account/list", { cache: "no-store" }),
      ]);
      if (!res.ok) return;
      const body = (await res.json()) as { accounts: AccessibleAccount[] };
      setAccounts(body.accounts);

      const stored =
        typeof window !== "undefined" ? localStorage.getItem(ACTIVE_ACCOUNT_KEY) : null;
      const valid = stored && body.accounts.some((a) => a.account_id === stored);
      const fallback =
        body.accounts.find((a) => a.account_id === userId)?.account_id ??
        body.accounts[0]?.account_id ??
        userId;
      setActiveAccountIdState(valid ? stored : fallback);
    } catch (err) {
      console.error("[useSite] failed to load accounts:", err);
    } finally {
      setAccountsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  // Effective owner whose sites we should load. Admin view-as overrides;
  // otherwise the active account.
  const effectiveOwnerId = viewAs?.userId ?? activeAccountId ?? user?.id ?? "";

  const loadSites = useCallback(async () => {
    if (!effectiveOwnerId) {
      setSites([]);
      setActiveSiteIdState(null);
      setLoading(false);
      return;
    }
    // Drop any cached rows from the previous owner before we hit the network
    // — otherwise `activeSite` keeps falling back to the old `sites[0]` while
    // the new fetch is in flight.
    setSites([]);
    setActiveSiteIdState(null);
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
          const stored =
            typeof window !== "undefined"
              ? localStorage.getItem(ACTIVE_SITE_KEY)
              : null;
          const valid = stored && loaded.some((s) => s.id === stored);
          const resolved = valid ? stored : (loaded[0]?.id ?? null);
          setActiveSiteIdState(resolved);
          if (typeof window !== "undefined") {
            try {
              if (resolved) localStorage.setItem(ACTIVE_SITE_KEY, resolved);
              else localStorage.removeItem(ACTIVE_SITE_KEY);
            } catch { /* private mode etc. */ }
          }
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
    if ((!data || data.length === 0) && effectiveOwnerId === userId) {
      // maybeSingle so brand-new users (no user_settings row) don't get a
      // 406 in the console for the expected "no row" case.
      const { data: legacyRow } = await supabase
        .from("user_settings")
        .select("settings")
        .eq("user_id", userId)
        .maybeSingle();

      if (legacyRow?.settings) {
        const s = legacyRow.settings as Record<string, unknown>;
        const { error: insertError } = await supabase.from("user_sites").insert({
          id: userId,
          user_id: userId,
          site_name: (s.brand_name as string) || "Webbsida 1",
          settings: s,
        });
        if (!insertError) {
          const { data: fresh } = await supabase
            .from("user_sites")
            .select("*")
            .eq("user_id", userId)
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
    const resolved = valid ? stored : (loaded[0]?.id ?? null);
    setActiveSiteIdState(resolved);
    if (typeof window !== "undefined") {
      try {
        if (resolved) localStorage.setItem(ACTIVE_SITE_KEY, resolved);
        else localStorage.removeItem(ACTIVE_SITE_KEY);
      } catch { /* private mode etc. */ }
    }

    setLoading(false);
  }, [effectiveOwnerId, viewAs, userId]);

  // Gate site loading on accounts being resolved first — unless we're in
  // view-as mode (where effectiveOwnerId comes from viewAs, not accounts).
  // Without this gate, loadSites fires immediately with effectiveOwnerId =
  // user.id (the member's own id), finds 0 sites, and the dashboard
  // redirects to /c/onboarding before loadAccounts returns the real owner id.
  useEffect(() => {
    if (viewAs || !accountsLoading) void loadSites();
  }, [loadSites, accountsLoading, viewAs]);

  // Switching tenant is treated as navigating to a different workspace —
  // the only way to guarantee no data leaks across the boundary is to
  // throw out the entire JS context and start fresh.
  const setActiveSiteId = useCallback((id: string) => {
    if (typeof window === "undefined") return;
    if (id === activeSiteId) return;
    try {
      localStorage.setItem(ACTIVE_SITE_KEY, id);
    } catch { /* private mode etc. */ }
    window.location.reload();
  }, [activeSiteId]);

  const setActiveAccountId = useCallback((id: string) => {
    if (typeof window === "undefined") return;
    if (id === activeAccountId) return;
    try {
      localStorage.setItem(ACTIVE_ACCOUNT_KEY, id);
      localStorage.removeItem(ACTIVE_SITE_KEY);
    } catch { /* private mode etc. */ }
    window.location.reload();
  }, [activeAccountId]);

  const setViewAs = useCallback((v: ViewAs) => {
    if (typeof window === "undefined") return;
    try {
      sessionStorage.setItem(VIEW_AS_KEY, JSON.stringify(v));
      localStorage.removeItem(ACTIVE_SITE_KEY);
    } catch { /* ignore */ }
    window.location.reload();
  }, []);

  const clearViewAs = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      sessionStorage.removeItem(VIEW_AS_KEY);
      localStorage.removeItem(ACTIVE_SITE_KEY);
    } catch { /* ignore */ }
    window.location.reload();
  }, []);

  const activeSite = useMemo(
    () => sites.find((s) => s.id === activeSiteId) ?? sites[0] ?? null,
    [sites, activeSiteId]
  );

  const effectiveTenantId =
    activeSite?.id ?? viewAs?.tenantId ?? effectiveOwnerId;

  const tenantClient = useMemo(
    () =>
      tenantApi(
        effectiveTenantId,
        viewAs?.userId ?? activeAccountId ?? undefined,
      ),
    [effectiveTenantId, viewAs, activeAccountId],
  );

  const myRole = useMemo<AccountRole | null>(() => {
    if (!activeAccountId) return null;
    return accounts.find((a) => a.account_id === activeAccountId)?.role ?? null;
  }, [accounts, activeAccountId]);

  const effectiveAccountId = viewAs?.userId ?? activeAccountId;

  const value = useMemo<SiteContextValue>(
    () => ({
      sites,
      activeSite,
      // Expose a combined loading flag: consumers should treat the context as
      // unready until both accounts and sites have been fetched. This prevents
      // the dashboard onboarding gate from seeing sites=[] and redirecting to
      // /c/onboarding while accountsLoading is still true.
      loading: loading || accountsLoading,
      setActiveSiteId,
      tenantClient,
      effectiveTenantId,
      effectiveOwnerId,
      viewAs,
      setViewAs,
      clearViewAs,
      reloadSites: loadSites,
      accounts,
      activeAccountId: effectiveAccountId,
      setActiveAccountId,
      myRole,
      reloadAccounts: loadAccounts,
    }),
    [
      sites, activeSite, loading, accountsLoading, setActiveSiteId, tenantClient,
      effectiveTenantId, effectiveOwnerId, viewAs, setViewAs, clearViewAs, loadSites,
      accounts, effectiveAccountId, setActiveAccountId, myRole, loadAccounts,
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
