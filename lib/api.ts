/**
 * Centralized API client for SAMA backend.
 * - Single source for base URL
 * - Automatic retry with exponential backoff
 * - Consistent error formatting
 */

/**
 * BASE_URL routes all browser-side backend calls through the Next.js proxy
 * at /api/sama. The proxy reads the Supabase session and injects the
 * server-validated X-Sama-Account-Id / X-Sama-Site-Id headers before
 * forwarding to the real backend (configured server-side via SAMA_API_URL).
 *
 * The browser MUST NOT hit the backend directly: it has no way to attach
 * a verified tenant identity, so the backend's tenant middleware now
 * rejects those calls with 401. NEXT_PUBLIC_SAMA_API_URL is intentionally
 * not used here — point SAMA_API_URL (server-side) at your dev backend
 * instead.
 */
const BASE_URL = '/api/sama';

/**
 * Paths that may not exist on the backend yet. These always go through the
 * local Next.js proxy (which translates upstream 404s to 200/{}) so the
 * dashboard doesn't flood the browser console with red network errors that
 * the UI already handles silently. Bypasses NEXT_PUBLIC_SAMA_API_URL.
 */
const SOFT_404_PATTERNS: RegExp[] = [
  /^\/api\/activity(\b|\/|\?)/,
  /^\/api\/content\/stats(\b|\/|\?)/,
];

function resolveUrl(path: string): string {
  if (SOFT_404_PATTERNS.some((re) => re.test(path))) {
    return `/api/sama${path}`;
  }
  return `${BASE_URL}${path}`;
}

/**
 * Public helper for legacy pages that build URLs as `${SAMA_API_URL}/api/...`.
 * Resolves to the same proxy path as BASE_URL by default.
 */
export const SAMA_API_URL = BASE_URL;

/**
 * Reads the active account/site/view-as identifiers stashed by the
 * customer-portal SiteProvider so admin pages outside the provider can
 * still tag their requests. Falls back to no headers when nothing is set
 * (in which case the proxy will resolve from the user's auth context).
 */
/**
 * `fetch`-compatible wrapper that:
 *   - prepends the proxy base URL (so callers can pass relative paths)
 *   - merges `samaHeaders()` so account/site context tags every request
 *
 * Use from pages that live outside the customer-portal SiteProvider
 * (e.g. admin /seo, /ai-visibility) where `tenantApi` isn't available.
 */
export function samaFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;
  const headers = new Headers(init?.headers);
  for (const [k, v] of Object.entries(samaHeaders())) {
    if (!headers.has(k)) headers.set(k, v);
  }
  return fetch(url, { ...init, headers });
}

export function samaHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const out: Record<string, string> = {};
  try {
    const accountId = localStorage.getItem("sama_active_account_id");
    const siteId = localStorage.getItem("sama_active_site_id");
    const viewAsRaw = sessionStorage.getItem("sama_admin_view_as");
    const viewAs = viewAsRaw
      ? (JSON.parse(viewAsRaw) as { userId?: string; tenantId?: string })
      : null;

    // In admin "view-as" mode the account header must point at the
    // viewed customer (not the logged-in admin). The site header should
    // honour the SiteSwitcher's selection — falling back to viewAs's
    // initial tenant only when no explicit choice has been stored.
    if (viewAs?.userId) {
      out["X-Sama-Account-Id"] = viewAs.userId;
    } else if (accountId) {
      out["X-Sama-Account-Id"] = accountId;
    }

    // SiteProvider clears localStorage[sama_active_site_id] when entering
    // or leaving view-as mode and rewrites it once the new tenant's sites
    // load, so a stale ID can't carry across the boundary. If localStorage
    // is missing during the brief window between the reload and that
    // rewrite, fall back to the view-as initial tenant.
    const resolvedSiteId = siteId || viewAs?.tenantId;
    if (resolvedSiteId) {
      out["X-Sama-Site-Id"] = resolvedSiteId;
      out["X-Tenant-ID"] = resolvedSiteId;
    }
  } catch {
    /* ignore — storage access can throw in private mode */
  }
  return out;
}

interface FetchOptions extends RequestInit {
  retries?: number;
  retryDelay?: number;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function fetchWithRetry(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  const { retries = 1, retryDelay = 1000, ...fetchOpts } = options;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        ...fetchOpts,
        signal: fetchOpts.signal || AbortSignal.timeout(60000),
      });

      if (response.ok || response.status < 500) {
        return response;
      }

      // Server error — retry
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, retryDelay * Math.pow(2, attempt)));
        continue;
      }
      return response;
    } catch (error) {
      if (attempt < retries && !(error instanceof DOMException && error.name === 'AbortError')) {
        await new Promise(r => setTimeout(r, retryDelay * Math.pow(2, attempt)));
        continue;
      }
      throw error;
    }
  }

  throw new Error('Request failed after retries');
}

export const api = {
  baseUrl: BASE_URL,

  async get<T = any>(path: string, options?: FetchOptions): Promise<T> {
    const res = await fetchWithRetry(resolveUrl(path), { method: 'GET', ...options });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new ApiError(`GET ${path}: ${res.status} ${detail.slice(0, 200)}`, res.status);
    }
    return res.json();
  },

  async post<T = any>(path: string, body?: any, options?: FetchOptions): Promise<T> {
    const { headers: extraHeaders, ...restOptions } = options || {};
    const res = await fetchWithRetry(resolveUrl(path), {
      method: 'POST',
      ...restOptions,
      headers: { 'Content-Type': 'application/json', ...extraHeaders },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new ApiError(`POST ${path}: ${res.status} ${detail.slice(0, 200)}`, res.status);
    }
    return res.json();
  },

  async patch<T = any>(path: string, body?: any, options?: FetchOptions): Promise<T> {
    const { headers: extraHeaders, ...restOptions } = options || {};
    const res = await fetchWithRetry(resolveUrl(path), {
      method: 'PATCH',
      ...restOptions,
      headers: { 'Content-Type': 'application/json', ...extraHeaders },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new ApiError(`PATCH ${path}: ${res.status} ${detail.slice(0, 200)}`, res.status);
    }
    return res.json();
  },

  async delete(path: string, body?: any, options?: FetchOptions): Promise<void> {
    const res = await fetchWithRetry(resolveUrl(path), {
      method: 'DELETE',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      ...options,
    });
    if (!res.ok) throw new ApiError(`DELETE ${path} failed`, res.status);
  },
};

/**
 * Creates a tenant-scoped API client that automatically includes the
 * tenant/account/site headers on every request. The proxy resolves these
 * server-side too, but sending them client-side avoids an extra DB lookup
 * on the hot path.
 */
export function tenantApi(tenantId: string, accountId?: string) {
  const tenantHeaders: Record<string, string> = {
    'X-Tenant-ID': tenantId,
    'X-Sama-Site-Id': tenantId,
  };
  if (accountId) tenantHeaders['X-Sama-Account-Id'] = accountId;
  return {
    get: <T = any>(path: string, options?: FetchOptions): Promise<T> =>
      api.get<T>(path, {
        ...options,
        headers: { ...tenantHeaders, ...options?.headers },
      }),
    post: <T = any>(path: string, body?: any, options?: FetchOptions): Promise<T> =>
      api.post<T>(path, body, {
        ...options,
        headers: { ...tenantHeaders, ...options?.headers },
      }),
    patch: <T = any>(path: string, body?: any, options?: FetchOptions): Promise<T> =>
      api.patch<T>(path, body, {
        ...options,
        headers: { ...tenantHeaders, ...options?.headers },
      }),
    delete: (path: string, body?: any, options?: FetchOptions): Promise<void> =>
      api.delete(path, body, {
        ...options,
        headers: { ...tenantHeaders, ...options?.headers },
      }),
  };
}

/**
 * Poll an agent_runs row until it leaves the "running" state.
 *
 * The backend trigger endpoint returns immediately with run_id; the actual
 * cycle runs in a background task. Callers use this helper to follow
 * completion without holding a long HTTP connection.
 *
 * Resolves with the final run record. If polling exceeds `timeoutMs` it
 * resolves with the last seen record (caller can check status).
 */
export interface AgentRun {
  id: string;
  agent_name: string;
  status: 'running' | 'completed' | 'failed' | string;
  started_at: string;
  completed_at: string | null;
  summary: string | null;
  error?: string | null;
}

export async function pollAgentRun(
  tenantId: string,
  runId: string,
  options: {
    intervalMs?: number;
    timeoutMs?: number;
    onUpdate?: (run: AgentRun) => void;
  } = {},
): Promise<AgentRun> {
  const interval = options.intervalMs ?? 3000;
  const timeout = options.timeoutMs ?? 15 * 60 * 1000; // matches backend STALE_RUN_AFTER
  const client = tenantApi(tenantId);
  const start = Date.now();
  let last: AgentRun | null = null;

  while (Date.now() - start < timeout) {
    try {
      const run = await client.get<AgentRun>(`/api/tenant/agent-runs/${runId}`);
      last = run;
      options.onUpdate?.(run);
      if (run.status !== 'running') return run;
    } catch {
      // transient errors don't abort polling — the run may still finish
    }
    await new Promise((r) => setTimeout(r, interval));
  }
  return last ?? ({ id: runId, agent_name: '', status: 'running', started_at: new Date().toISOString(), completed_at: null, summary: null } as AgentRun);
}

/**
 * Stream agent run status via Server-Sent Events when AGENT_RUN_STREAM is on,
 * falling back to polling otherwise. The SSE endpoint emits one JSON message
 * per status change ({status, completed_at, summary, error}); the caller
 * resolves with the final AgentRun.
 *
 * If the SSE endpoint returns 404/501 (backend hasn't deployed it yet) we
 * silently fall back to ``pollAgentRun``. Same for Safari < 17 / older
 * browsers without ``EventSource`` support.
 */
export async function watchAgentRun(
  tenantId: string,
  runId: string,
  options: {
    timeoutMs?: number;
    onUpdate?: (run: AgentRun) => void;
  } = {},
): Promise<AgentRun> {
  const streamEnabled =
    typeof window !== "undefined" &&
    "EventSource" in window &&
    process.env.NEXT_PUBLIC_AGENT_RUN_STREAM !== "0";
  if (!streamEnabled) {
    return pollAgentRun(tenantId, runId, options);
  }
  const timeout = options.timeoutMs ?? 15 * 60 * 1000;
  const url = `/api/sama/api/tenant/agent-runs/${encodeURIComponent(runId)}/stream`;

  return new Promise<AgentRun>((resolve) => {
    const es = new EventSource(url, { withCredentials: true });
    let last: AgentRun | null = null;
    let resolved = false;

    const finish = (run: AgentRun) => {
      if (resolved) return;
      resolved = true;
      es.close();
      resolve(run);
    };

    const fallback = async () => {
      es.close();
      const run = await pollAgentRun(tenantId, runId, options);
      finish(run);
    };

    es.onmessage = (ev) => {
      try {
        const run = JSON.parse(ev.data) as AgentRun;
        last = run;
        options.onUpdate?.(run);
        if (run.status !== "running") finish(run);
      } catch {
        // ignore malformed events
      }
    };
    es.onerror = () => {
      // EventSource auto-reconnects on transient errors; only fall back if
      // the server returned a hard 4xx/5xx by closing immediately.
      if (es.readyState === EventSource.CLOSED) {
        if (last) finish(last);
        else void fallback();
      }
    };
    setTimeout(() => {
      if (!resolved) finish(last ?? ({ id: runId, agent_name: "", status: "running", started_at: new Date().toISOString(), completed_at: null, summary: null } as AgentRun));
    }, timeout);
  });
}
