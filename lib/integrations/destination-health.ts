/**
 * Is this site's publish destination still working?
 *
 * `lib/content/site-readiness.ts` can only see what is *configured* — it is a
 * pure function over the settings blob. A GitHub token that expired last week
 * is still configured, so the Sites page reported the site as ready while both
 * the publish dialog and the 5-minute publish cron were failing with HTTP 401.
 * That gap is the whole reason this module exists: it asks the CMS.
 *
 * Every adapter's `validate()` is a cheap read against the destination the
 * article would be written to (for GitHub: `GET /repos/{owner}/{name}`, which
 * catches a dead token as 401 and a lost grant as 404), so this is the same
 * check the connect flow runs — just after the fact.
 */
import type { CmsDestination, CmsKind } from "./cms/types";
import { getAdapter } from "./cms";
import { assertPublicHttpUrl } from "@/lib/security/url-guard";

/**
 * Config keys that hold a URL an adapter will fetch. `POST /destinations` can
 * be told to skip validation, so a stored config is not proof that its URL was
 * ever checked — and this module turns "fetch that URL" into a plain GET
 * anyone can call. Same guard as /api/integrations/test, for the same reason.
 */
const URL_CONFIG_KEYS = ["site_url", "api_url", "url"];

function unreachableUrl(config: Record<string, string>): string | null {
  for (const key of URL_CONFIG_KEYS) {
    const value = config?.[key];
    if (!value) continue;
    let candidate = value.trim();
    if (!/^https?:\/\//i.test(candidate)) candidate = `https://${candidate}`;
    try {
      assertPublicHttpUrl(candidate);
    } catch (e) {
      return e instanceof Error ? e.message : `${key} is not a public URL`;
    }
  }
  return null;
}

export type DestinationHealthState =
  /** The CMS answered and accepted the credentials. */
  | "ok"
  /** The CMS answered and refused — nothing publishes until it is fixed. */
  | "failing"
  /** We could not tell: no validation for this kind, or the check timed out. */
  | "unknown";

export interface DestinationHealth {
  state: DestinationHealthState;
  /** Why it is failing, in the adapter's own words. Absent when healthy. */
  message?: string;
  destination_id: string;
  destination_name: string;
  kind: CmsKind;
  checked_at: string;
}

const CHECK_TIMEOUT_MS = 8_000;
/**
 * Health is only rendered on a settings page, but that page reloads often and
 * every reload costs one API call per site against someone else's rate limit.
 * A short TTL keeps it honest (a reconnect shows up within a minute) while
 * absorbing refreshes; the key includes the config so a *new* token is checked
 * immediately rather than inheriting the old verdict.
 */
const TTL_MS = 60_000;
const cache = new Map<string, { at: number; health: DestinationHealth }>();

function fingerprint(config: Record<string, string>): string {
  const s = JSON.stringify(config ?? {});
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export async function checkDestinationHealth(dest: CmsDestination): Promise<DestinationHealth> {
  const base = {
    destination_id: dest.id,
    destination_name: dest.name,
    kind: dest.kind,
  };
  const key = `${dest.id}:${dest.kind}:${fingerprint(dest.config)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.health;

  let health: DestinationHealth;
  const blocked = unreachableUrl(dest.config);
  if (blocked) {
    // Never probe it; a destination we refuse to fetch will never publish
    // either, so "failing" is also the honest verdict.
    health = { ...base, state: "failing", message: blocked, checked_at: new Date().toISOString() };
    cache.set(key, { at: Date.now(), health });
    return health;
  }
  try {
    const adapter = getAdapter(dest.kind);
    if (!adapter.validate) {
      // A webhook has nothing to probe without POSTing to it, which would
      // publish. "unknown" is the honest answer; readiness leaves it alone.
      health = { ...base, state: "unknown", checked_at: new Date().toISOString() };
    } else {
      const result = await withTimeout(adapter.validate(dest.config));
      health = result
        ? {
            ...base,
            state: result.ok ? "ok" : "failing",
            message: result.ok ? undefined : result.message || "The CMS refused the connection",
            checked_at: new Date().toISOString(),
          }
        : { ...base, state: "unknown", checked_at: new Date().toISOString() };
    }
  } catch {
    // A thrown validate() is a network failure, not a verdict on the
    // credentials — don't cry wolf over a blip.
    health = { ...base, state: "unknown", checked_at: new Date().toISOString() };
  }

  cache.set(key, { at: Date.now(), health });
  return health;
}

async function withTimeout(
  p: Promise<{ ok: boolean; message?: string }>,
): Promise<{ ok: boolean; message?: string } | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      p,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), CHECK_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
