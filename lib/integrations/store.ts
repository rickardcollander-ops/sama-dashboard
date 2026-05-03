import { createSupabaseServerClient } from "@/lib/supabase-server";
import { CmsDestination, CmsKind } from "./cms/types";

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
    .single();
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

export async function getDestinations(userId: string): Promise<CmsDestination[]> {
  const settings = await loadSettings(userId);
  const list = settings[PUBLISHING_KEY];
  return Array.isArray(list) ? (list as CmsDestination[]) : [];
}

export async function saveDestinations(userId: string, destinations: CmsDestination[]): Promise<void> {
  const settings = await loadSettings(userId);
  await saveSettings(userId, { ...settings, [PUBLISHING_KEY]: destinations });
}

export async function upsertDestination(
  userId: string,
  draft: { id?: string; kind: CmsKind; name: string; config: Record<string, string> },
): Promise<CmsDestination> {
  const list = await getDestinations(userId);
  if (draft.id) {
    const idx = list.findIndex((d) => d.id === draft.id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], kind: draft.kind, name: draft.name, config: draft.config };
      await saveDestinations(userId, list);
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
  await saveDestinations(userId, list);
  return dest;
}

export async function deleteDestination(userId: string, id: string): Promise<void> {
  const list = await getDestinations(userId);
  await saveDestinations(userId, list.filter((d) => d.id !== id));
}

export async function getScheduled(userId: string): Promise<ScheduledPublish[]> {
  const settings = await loadSettings(userId);
  const list = settings[SCHEDULE_KEY];
  return Array.isArray(list) ? (list as ScheduledPublish[]) : [];
}

export async function saveScheduled(userId: string, scheduled: ScheduledPublish[]): Promise<void> {
  const settings = await loadSettings(userId);
  await saveSettings(userId, { ...settings, [SCHEDULE_KEY]: scheduled });
}

export async function appendScheduled(
  userId: string,
  draft: Omit<ScheduledPublish, "id" | "status">,
): Promise<ScheduledPublish> {
  const list = await getScheduled(userId);
  const item: ScheduledPublish = {
    id: `sched_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    status: "scheduled",
    ...draft,
  };
  list.push(item);
  await saveScheduled(userId, list);
  return item;
}

export async function updateScheduled(
  userId: string,
  id: string,
  patch: Partial<ScheduledPublish>,
): Promise<void> {
  const list = await getScheduled(userId);
  const next = list.map((s) => (s.id === id ? { ...s, ...patch } : s));
  await saveScheduled(userId, next);
}

export async function removeScheduled(userId: string, id: string): Promise<void> {
  const list = await getScheduled(userId);
  await saveScheduled(userId, list.filter((s) => s.id !== id));
}
