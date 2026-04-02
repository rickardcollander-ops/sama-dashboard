/**
 * Centralized API client for SAMA backend.
 * - Single source for base URL
 * - Automatic retry with exponential backoff
 * - Consistent error formatting
 */

const BASE_URL = process.env.NEXT_PUBLIC_SAMA_API_URL || 'https://web-production-5324a.up.railway.app';

interface FetchOptions extends RequestInit {
  retries?: number;
  retryDelay?: number;
}

class ApiError extends Error {
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
    const res = await fetchWithRetry(`${BASE_URL}${path}`, { method: 'GET', ...options });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new ApiError(`GET ${path}: ${res.status} ${detail.slice(0, 200)}`, res.status);
    }
    return res.json();
  },

  async post<T = any>(path: string, body?: any, options?: FetchOptions): Promise<T> {
    const { headers: extraHeaders, ...restOptions } = options || {};
    const res = await fetchWithRetry(`${BASE_URL}${path}`, {
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
    const res = await fetchWithRetry(`${BASE_URL}${path}`, {
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
