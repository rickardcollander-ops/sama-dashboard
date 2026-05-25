import { createSupabaseServerClient } from "@/lib/supabase-server";
import { CmsDestination, CmsKind } from "./cms/types";

export const GITHUB_VIRTUAL_DEST_ID = "github-default";
const GITHUB_SETTINGS_KEY = "github";

interface StoredGitHubConfig {
  token?: string;
  repo_owner?: string;
  repo_name?: string;
  blog_path?: string;
  branch?: string;
  connected_at?: string;
}

export function buildGithubVirtualDestination(
  settings: SettingsJson,
): CmsDestination | null {
  const raw = settings[GITHUB_SETTINGS_KEY];
  if (!raw || typeof raw !== "object") return null;
  const cfg = raw as StoredGitHubConfig;
  if (!cfg.token || !cfg.repo_owner || !cfg.repo_name) return null;
  return {
    id: GITHUB_VIRTUAL_DEST_ID,
    kind: "github",
    name: `GitHub — ${cfg.repo_owner}/${cfg.repo_name}`,
    config: {
      token: cfg.token,
      repo_owner: cfg.repo_owner,
      repo_name: cfg.repo_name,
      blog_path: cfg.blog_path || "content/blog",
      branch: cfg.branch || "main",
    },
    created_at: cfg.connected_at || new Date(0).toISOString(),
  };
}

export {
  MAX_GEO_QUERIES,
  AI_VISIBILITY_LOCK_DAYS,
  GEO_QUERIES_STALE_DAYS,
} from "./store-constants";

const PUBLISHING_KEY = "publishing_destinations";
const SCHEDULE_KEY = "scheduled_publishes";

export interface ScheduledPublish {
  id: string;
  piece_id: string;
  destination_id: string;
  scheduled_at: string;
  status: "scheduled" | "publishing" | "published" | "failed";
  published_url?: string;
  error?: string;
  payload?: Record<string, unknown>;
}

export interface UserPublishingState {
  destinations: CmsDestination[];
  scheduled: ScheduledPublish[];
}

export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

export type SettingsJson = Record<string, unknown>;

export async function loadSettings(userId: string): Promise<SettingsJson> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("user_settings")
    .select("settings")
    .eq("user_id", userId)
    .maybeSingle();
  return (data?.settings as SettingsJson) || {};
}

export async function saveSettings(userId: string, settings: SettingsJson): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("user_settings")
    .upsert(
      { user_id: userId, settings, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
  if (error) throw new Error(error.message);
}

// Site-scoped settings storage. Destinations and scheduled publishes live on
// the workspace (user_sites) row, not on the per-user user_settings row, so
// each workspace has its own list. RLS on user_sites already restricts access
// to the owner and account members.
export async function loadSiteSettings(siteId: string): Promise<SettingsJson> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("user_sites")
    .select("settings")
    .eq("id", siteId)
    .maybeSingle();
  return (data?.settings as SettingsJson) || {};
}

export async function saveSiteSettings(siteId: string, settings: SettingsJson): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("user_sites")
    .update({ settings, updated_at: new Date().toISOString() })
    .eq("id", siteId);
  if (error) throw new Error(error.message);
}

// Resolve a workspace id from the X-Tenant-ID header. Falls back to userId
// (which is also the primary site id by convention).
export function resolveSiteId(req: { headers: Headers }, userId: string): string {
  return req.headers.get("X-Tenant-ID") || userId;
}

// One-shot read fallback so we don't orphan destinations created before the
// per-workspace migration. Only applies to the primary site (siteId === userId).
async function readDestinationsWithLegacyFallback(
  siteId: string,
  userId: string,
): Promise<CmsDestination[]> {
  const siteSettings = await loadSiteSettings(siteId);
  const list = siteSettings[PUBLISHING_KEY];
  const stored: CmsDestination[] = Array.isArray(list)
    ? (list as CmsDestination[])
    : siteId === userId
      ? await readLegacyPrimary(userId)
      : [];

  // Surface the standalone GitHub connection as a virtual destination so users
  // who connected GitHub via Settings → Integrations see it in the publish
  // dialog without having to add it again as a CMS destination.
  const githubVirtual = buildGithubVirtualDestination(siteSettings);
  if (!githubVirtual) return stored;
  if (stored.some((d) => d.id === githubVirtual.id)) return stored;
  return [githubVirtual, ...stored];
}

async function readLegacyPrimary(userId: string): Promise<CmsDestination[]> {
  const legacy = await loadSettings(userId);
  const legacyList = legacy[PUBLISHING_KEY];
  return Array.isArray(legacyList) ? (legacyList as CmsDestination[]) : [];
}

async function readScheduledWithLegacyFallback(
  siteId: string,
  userId: string,
): Promise<ScheduledPublish[]> {
  const siteSettings = await loadSiteSettings(siteId);
  const list = siteSettings[SCHEDULE_KEY];
  if (Array.isArray(list)) return list as ScheduledPublish[];

  if (siteId === userId) {
    const legacy = await loadSettings(userId);
    const legacyList = legacy[SCHEDULE_KEY];
    if (Array.isArray(legacyList)) return legacyList as ScheduledPublish[];
  }
  return [];
}

export async function getDestinations(siteId: string, userId: string): Promise<CmsDestination[]> {
  return readDestinationsWithLegacyFallback(siteId, userId);
}

export async function saveDestinations(siteId: string, destinations: CmsDestination[]): Promise<void> {
  const settings = await loadSiteSettings(siteId);
  await saveSiteSettings(siteId, { ...settings, [PUBLISHING_KEY]: destinations });
}

export async function upsertDestination(
  siteId: string,
  userId: string,
  draft: { id?: string; kind: CmsKind; name: string; config: Record<string, string> },
): Promise<CmsDestination> {
  const list = await getDestinations(siteId, userId);
  if (draft.id) {
    const idx = list.findIndex((d) => d.id === draft.id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], kind: draft.kind, name: draft.name, config: draft.config };
      await saveDestinations(siteId, list);
      return list[idx];
    }
  }
  const dest: CmsDestination = {
    id: `dest_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    kind: draft.kind,
    name: draft.name,
    config: draft.config,
    created_at: new Date().toISOString(),
  };
  list.push(dest);
  await saveDestinations(siteId, list);
  return dest;
}

export async function deleteDestination(siteId: string, userId: string, id: string): Promise<void> {
  const list = await getDestinations(siteId, userId);
  await saveDestinations(siteId, list.filter((d) => d.id !== id));
}

export async function getScheduled(siteId: string, userId: string): Promise<ScheduledPublish[]> {
  return readScheduledWithLegacyFallback(siteId, userId);
}

export async function saveScheduled(siteId: string, scheduled: ScheduledPublish[]): Promise<void> {
  const settings = await loadSiteSettings(siteId);
  await saveSiteSettings(siteId, { ...settings, [SCHEDULE_KEY]: scheduled });
}

export async function appendScheduled(
  siteId: string,
  userId: string,
  draft: Omit<ScheduledPublish, "id" | "status">,
): Promise<ScheduledPublish> {
  const list = await getScheduled(siteId, userId);
  const item: ScheduledPublish = {
    id: `sched_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    status: "scheduled",
    ...draft,
  };
  list.push(item);
  await saveScheduled(siteId, list);
  return item;
}

export async function updateScheduled(
  siteId: string,
  userId: string,
  id: string,
  patch: Partial<ScheduledPublish>,
): Promise<void> {
  const list = await getScheduled(siteId, userId);
  const next = list.map((s) => (s.id === id ? { ...s, ...patch } : s));
  await saveScheduled(siteId, next);
}

export async function removeScheduled(siteId: string, userId: string, id: string): Promise<void> {
  const list = await getScheduled(siteId, userId);
  await saveScheduled(siteId, list.filter((s) => s.id !== id));
}
