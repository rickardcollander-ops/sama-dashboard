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
  const { retries = 2, retryDelay = 1000, ...fetchOpts } = options;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        ...fetchOpts,
        signal: fetchOpts.signal || AbortSignal.timeout(15000),
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
    if (!res.ok) throw new ApiError(`GET ${path} failed`, res.status);
    return res.json();
  },

  async post<T = any>(path: string, body?: any, options?: FetchOptions): Promise<T> {
    const res = await fetchWithRetry(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      ...options,
    });
    if (!res.ok) throw new ApiError(`POST ${path} failed`, res.status);
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
