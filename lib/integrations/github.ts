import { loadSiteSettings, saveSiteSettings } from "./store";

const GITHUB_API = "https://api.github.com";
const UA = "sama-dashboard";

export const GITHUB_SETTINGS_KEY = "github";

export interface GitHubConfig {
  token: string;
  repo_owner?: string;
  repo_name?: string;
  blog_path?: string;
  branch?: string;
  connected_at?: string;
}

export interface GitHubStatus {
  connected: boolean;
  repo_owner?: string;
  repo_name?: string;
  repo?: string;
  blog_path?: string;
  branch?: string;
  token_masked?: string;
}

export interface GitHubRepo {
  full_name: string;
  owner: string;
  name: string;
  private: boolean;
  default_branch: string;
}

function maskToken(token: string): string {
  if (!token) return "";
  if (token.length <= 8) return "••••";
  return `••••${token.slice(-4)}`;
}

async function githubFetch(path: string, token: string, init?: RequestInit): Promise<Response> {
  return fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": UA,
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });
}

export interface GitHubUser {
  login: string;
  id: number;
}

export async function validateGitHubToken(token: string): Promise<GitHubUser> {
  const res = await githubFetch("/user", token);
  if (res.status === 401) {
    throw new GitHubError("GitHub token is invalid or expired", 401);
  }
  if (!res.ok) {
    throw new GitHubError(`GitHub token validation failed (HTTP ${res.status})`, res.status);
  }
  const data = (await res.json()) as { login?: string; id?: number };
  if (!data?.login || typeof data.id !== "number") {
    throw new GitHubError("Unexpected response from GitHub /user", 502);
  }
  return { login: data.login, id: data.id };
}

interface RawRepo {
  full_name: string;
  name: string;
  private: boolean;
  default_branch: string | null;
  owner: { login: string } | null;
}

export async function listGitHubRepos(token: string): Promise<GitHubRepo[]> {
  const repos: GitHubRepo[] = [];
  for (let page = 1; page <= 5; page++) {
    const res = await githubFetch(
      `/user/repos?per_page=100&page=${page}&sort=updated&affiliation=owner,collaborator,organization_member`,
      token,
    );
    if (res.status === 401) {
      throw new GitHubError("GitHub token is invalid or expired", 401);
    }
    if (!res.ok) {
      throw new GitHubError(`Could not list repos (HTTP ${res.status})`, res.status);
    }
    const data = (await res.json()) as RawRepo[];
    for (const r of data) {
      if (!r?.full_name || !r?.owner?.login) continue;
      repos.push({
        full_name: r.full_name,
        owner: r.owner.login,
        name: r.name,
        private: !!r.private,
        default_branch: r.default_branch || "main",
      });
    }
    if (data.length < 100) break;
  }
  return repos;
}

export async function getGitHubConfig(siteId: string): Promise<GitHubConfig | null> {
  const settings = await loadSiteSettings(siteId);
  const raw = settings[GITHUB_SETTINGS_KEY];
  if (!raw || typeof raw !== "object") return null;
  const cfg = raw as Partial<GitHubConfig>;
  if (!cfg.token) return null;
  return {
    token: cfg.token,
    repo_owner: cfg.repo_owner,
    repo_name: cfg.repo_name,
    blog_path: cfg.blog_path,
    branch: cfg.branch,
    connected_at: cfg.connected_at,
  };
}

export async function saveGitHubConfig(siteId: string, config: GitHubConfig): Promise<void> {
  const settings = await loadSiteSettings(siteId);
  await saveSiteSettings(siteId, { ...settings, [GITHUB_SETTINGS_KEY]: config });
}

export async function clearGitHubConfig(siteId: string): Promise<void> {
  const settings = await loadSiteSettings(siteId);
  const next = { ...settings };
  delete next[GITHUB_SETTINGS_KEY];
  await saveSiteSettings(siteId, next);
}

export function configToStatus(cfg: GitHubConfig | null): GitHubStatus {
  if (!cfg || !cfg.repo_owner || !cfg.repo_name) {
    return { connected: false };
  }
  return {
    connected: true,
    repo_owner: cfg.repo_owner,
    repo_name: cfg.repo_name,
    repo: `${cfg.repo_owner}/${cfg.repo_name}`,
    blog_path: cfg.blog_path || "content/blog",
    branch: cfg.branch || "main",
    token_masked: maskToken(cfg.token),
  };
}

export class GitHubError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = "GitHubError";
    this.status = status;
  }
}
