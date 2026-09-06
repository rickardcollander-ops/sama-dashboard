// Will this site actually run on its own?
//
// An account can own several sites (successifier.com, successifier.se,
// supportifier.se). Each one carries its own brand, language, autopilot toggle
// and publish destination in `user_sites.settings`, and the crons read those
// per site. So one site can be fully automatic while the site next to it does
// nothing — and, until this module existed, nothing in the dashboard said why.
// A newly added site in particular starts with only a brand name and a domain,
// which is not enough for anything to happen.
//
// This is a pure function over a site's settings blob so it can be unit-tested
// and rendered without a round-trip. The predicates deliberately mirror the
// gates the crons apply:
//
//   - daily  (app/api/integrations/cron/daily-content)  — brand_name, content_autopilot.enabled
//   - weekly (app/api/integrations/cron/weekly-agents)  — brand_name, content_autopilot.enabled
//   - publish(app/api/integrations/cron + auto-publish-bridge)
//                                                       — content_autopilot.enabled, a destination
//
// If you change a gate in one of those routes, change it here too, or the
// dashboard will report a site as ready when the cron will skip it.

import { resolveSiteLanguage, languageFromDomain, normalizeLanguage } from "./language";

export type ReadinessStatus = "ok" | "blocked" | "info";

export interface ReadinessCheck {
  key: "brand" | "domain" | "language" | "autopilot" | "destination" | "onboarding";
  status: ReadinessStatus;
  /** Short label, already in Swedish (this dashboard's primary language). */
  label: string;
  /** One line saying what is set, or what to do about it. */
  detail: string;
  /** Where to go to fix it, when there is somewhere to go. */
  fixHref?: string;
}

export type AutopilotMode = "off" | "review" | "automatic";

export interface SiteReadiness {
  siteId: string;
  siteName: string;
  domain: string;
  /** Resolved language code, and whether it was configured or inferred. */
  language: string;
  languageInferred: boolean;
  mode: AutopilotMode;
  /** True when the daily and weekly crons will trigger the content agent. */
  willGenerate: boolean;
  /** True when a finished article has somewhere to be published to. */
  willPublish: boolean;
  checks: ReadinessCheck[];
}

interface GithubConfig {
  token?: string;
  repo_owner?: string;
  repo_name?: string;
}

interface AutopilotConfig {
  enabled?: boolean;
  auto_publish?: boolean;
}

function str(settings: Record<string, unknown>, key: string): string {
  const v = settings[key];
  return typeof v === "string" ? v.trim() : "";
}

/**
 * True when the site has somewhere to publish to.
 *
 * Mirrors `resolveBridgeDestination` in lib/integrations/auto-publish-bridge.ts:
 * a configured CMS destination, or the standalone GitHub connection (which
 * counts only once it has a repo, not merely a token).
 */
export function hasPublishDestination(settings: Record<string, unknown>): boolean {
  const list = settings.publishing_destinations;
  if (Array.isArray(list) && list.length > 0) return true;
  const gh = (settings.github || {}) as GithubConfig;
  return Boolean(gh.token && gh.repo_owner && gh.repo_name);
}

/** Human-readable name of the destination a published article would go to. */
export function describeDestination(settings: Record<string, unknown>): string {
  const list = settings.publishing_destinations;
  if (Array.isArray(list) && list.length > 0) {
    const first = list[0] as { name?: string; kind?: string };
    return first.name || first.kind || "CMS";
  }
  const gh = (settings.github || {}) as GithubConfig;
  if (gh.token && gh.repo_owner && gh.repo_name) {
    return `GitHub — ${gh.repo_owner}/${gh.repo_name}`;
  }
  return "";
}

/**
 * Days since the site finished onboarding, or null when it never did.
 *
 * The daily cron skips sites onboarded less than 30 days ago: onboarding
 * already produced a 30-day plan, so gap-filling on top would duplicate it.
 * That is expected behaviour, not a problem, so it surfaces as `info`.
 */
function daysSinceOnboarding(settings: Record<string, unknown>): number | null {
  const raw = str(settings, "onboarding_completed_at");
  if (!raw) return null;
  const ts = Date.parse(raw);
  if (Number.isNaN(ts)) return null;
  return (Date.now() - ts) / 86_400_000;
}

export function evaluateSiteReadiness(site: {
  id: string;
  site_name?: string | null;
  settings?: Record<string, unknown> | null;
}): SiteReadiness {
  const settings = site.settings || {};
  const brand = str(settings, "brand_name");
  const domain = str(settings, "domain");
  const configuredLanguage = normalizeLanguage(str(settings, "content_language"));
  const language = resolveSiteLanguage(settings);
  const languageInferred = !configuredLanguage;

  const ap = (settings.content_autopilot || {}) as AutopilotConfig;
  const autopilotOn = ap.enabled === true;
  const mode: AutopilotMode = !autopilotOn ? "off" : ap.auto_publish === true ? "automatic" : "review";

  const destination = describeDestination(settings);
  const hasDestination = Boolean(destination);

  const checks: ReadinessCheck[] = [];

  checks.push(
    brand
      ? { key: "brand", status: "ok", label: "Varumärke", detail: brand }
      : {
          key: "brand",
          status: "blocked",
          label: "Varumärke",
          // Both crons skip a site with no brand_name, so this blocks everything.
          detail: "Saknas — utan varumärkesnamn hoppar båda cron-jobben över sajten.",
          fixHref: "/c/settings",
        },
  );

  checks.push(
    domain
      ? { key: "domain", status: "ok", label: "Domän", detail: domain }
      : {
          key: "domain",
          status: "blocked",
          label: "Domän",
          detail: "Saknas — behövs för canonical-URL:er, interna länkar och språkval.",
          fixHref: "/c/settings",
        },
  );

  checks.push({
    key: "language",
    status: "ok",
    label: "Språk",
    detail: languageInferred
      ? `${language} (härlett från ${languageFromDomain(domain) ? `.${domain.split(".").pop()}` : "standard"} — sätt det explicit för att vara säker)`
      : language,
    fixHref: languageInferred ? "/c/settings" : undefined,
  });

  checks.push(
    autopilotOn
      ? {
          key: "autopilot",
          status: "ok",
          label: "Autopilot",
          detail:
            mode === "automatic"
              ? "På — skriver och publicerar automatiskt"
              : "På — utkast hamnar i godkännandekön",
          fixHref: "/c/content",
        }
      : {
          key: "autopilot",
          status: "blocked",
          label: "Autopilot",
          detail: "Av — inget genereras för den här sajten.",
          fixHref: "/c/content",
        },
  );

  checks.push(
    hasDestination
      ? { key: "destination", status: "ok", label: "Publiceringsmål", detail: destination }
      : {
          key: "destination",
          status: "blocked",
          label: "Publiceringsmål",
          detail:
            "Saknas — artiklar skrivs men blir liggande, eftersom de inte har någonstans att publiceras.",
          fixHref: "/c/settings#publishing",
        },
  );

  const onboardingDays = daysSinceOnboarding(settings);
  if (onboardingDays !== null && onboardingDays < 30) {
    checks.push({
      key: "onboarding",
      status: "info",
      label: "Nyligen onboardad",
      detail: `Den dagliga påfyllningen pausar i ${Math.ceil(30 - onboardingDays)} dagar till — 30-dagarsplanen från onboardingen gäller.`,
    });
  }

  return {
    siteId: site.id,
    siteName: site.site_name || brand || domain || "Namnlös sajt",
    domain,
    language,
    languageInferred,
    mode,
    willGenerate: Boolean(brand) && autopilotOn,
    willPublish: autopilotOn && hasDestination,
    checks,
  };
}

/** The blocking checks, in the order they need to be fixed. */
export function blockersFor(readiness: SiteReadiness): ReadinessCheck[] {
  return readiness.checks.filter((c) => c.status === "blocked");
}
