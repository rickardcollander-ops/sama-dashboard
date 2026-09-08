/**
 * Turning a CMS failure into a response the dashboard can honestly return.
 *
 * Adapters throw `PublishError` carrying the CMS's own HTTP status, and the
 * publish route used to hand that status straight back to the browser. For 401
 * and 403 that is actively misleading: a 401 from our own API means "your SAMA
 * session expired" everywhere else in this app, so an expired GitHub token read
 * as being signed out — and nobody went and reconnected the token. Worse, the
 * only clue in the console was `/api/integrations/publish 401`, which points at
 * the dashboard rather than at GitHub.
 *
 * So upstream auth failures become 502 (the upstream we depend on refused us),
 * keep the real status in `upstream_status`, and carry a `code` the UI can
 * localize plus the page that actually fixes it.
 */
import { CmsKind, PublishError } from "./cms/types";

export type PublishFailureCode =
  /** The destination's credentials are dead — expired, revoked, or wrong. */
  | "destination_auth"
  /** Credentials are live but refused this write (scope, or rate limit). */
  | "destination_forbidden"
  /** Anything else: kept as-is, including our own 400s. */
  | "publish_failed";

export interface PublishFailureBody {
  error: string;
  code: PublishFailureCode;
  /** The status the CMS itself returned, when the failure came from upstream. */
  upstream_status?: number;
  /** Where the user goes to fix it. */
  fix_href?: string;
  detail?: unknown;
}

export interface PublishFailure {
  /** The status the dashboard's own API answers with. */
  status: number;
  body: PublishFailureBody;
}

/**
 * The GitHub connection is configured in Settings → Publishing (it is a
 * first-class connection, not a CMS destination); every other kind lives in
 * the destinations list under Settings → Integrations.
 */
export function reconnectHref(kind?: CmsKind): string {
  return kind === "github" ? "/c/settings#publishing" : "/c/settings/integrations";
}

export function describePublishFailure(
  e: unknown,
  dest?: { kind: CmsKind; name?: string },
): PublishFailure {
  const upstream = e instanceof PublishError ? e.status : undefined;
  const detail = e instanceof PublishError ? e.detail : undefined;
  const message = e instanceof Error ? e.message : "Publish failed";
  const label = dest?.name || dest?.kind || "The destination";
  const fix_href = reconnectHref(dest?.kind);

  if (upstream === 401) {
    return {
      status: 502,
      body: {
        error: `${label}: the connection is no longer valid — the token is expired, revoked or wrong. Reconnect it, then publish again.`,
        code: "destination_auth",
        upstream_status: 401,
        fix_href,
        detail,
      },
    };
  }

  if (upstream === 403) {
    return {
      status: 502,
      body: {
        error: `${label} refused the request (HTTP 403) — the token is missing write permission for this destination, or its rate limit is spent.`,
        code: "destination_forbidden",
        upstream_status: 403,
        fix_href,
        detail,
      },
    };
  }

  // Everything else keeps its own status, so our own 400s ("connection
  // missing", "title required") stay 400 and read the way they always did.
  // A status outside the HTTP error range can only mean a non-PublishError
  // escaped an adapter, which is ours to own as a 500.
  const status = upstream && upstream >= 400 && upstream <= 599 ? upstream : 500;
  return {
    status,
    body: { error: message, code: "publish_failed", upstream_status: upstream, detail },
  };
}
