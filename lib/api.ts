/**
 * Centralized API client for SAMA backend.
 * - Single source for base URL
 * - Automatic retry with exponential backoff
 * - Consistent error formatting
 */

/**
 * BASE_URL routes all backend calls through the Next.js proxy at /api/sama
 * to bypass CORS. The proxy forwards server-to-server to the real backend
 * (configured via SAMA_API_URL env var on the server side).
 *
 * If NEXT_PUBLIC_SAMA_API_URL is explicitly set to a full URL it overrides
 * the proxy — useful for local dev pointing at a local backend with CORS
 * already configured.
 */
const RAW_BASE = process.env.NEXT_PUBLIC_SAMA_API_URL || '';
const BASE_URL = /^https?:\/\//.test(RAW_BASE) ? RAW_BASE : '/api/sama';

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
 * X-Tenant-ID header on every request.
 */
export function tenantApi(tenantId: string) {
  const tenantHeaders = { 'X-Tenant-ID': tenantId };
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
