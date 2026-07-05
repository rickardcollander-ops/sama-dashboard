/**
 * Paged fetch of every user_sites row.
 *
 * The cron routes previously did a single unbounded `.select()`, which is
 * silently capped by PostgREST's max-rows setting (commonly 1000): tenants
 * beyond the cap were never iterated — no publishes, no agent triggers, no
 * error. Page explicitly so growth past the cap can't drop sites.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface SiteRow {
  id: string;
  user_id: string;
  settings: Record<string, unknown> | null;
}

const PAGE_SIZE = 500;

export async function fetchAllSites(
  admin: SupabaseClient,
): Promise<{ rows: SiteRow[]; error: string | null }> {
  const rows: SiteRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await admin
      .from("user_sites")
      .select("id, user_id, settings")
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      return { rows, error: error.message };
    }
    const page = (data ?? []) as SiteRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return { rows, error: null };
}
