// Defense-in-depth helpers for tenant-isolation. The upstream agent backend
// is the source of truth for which audit belongs to which tenant, but we
// double-check on the dashboard side too: any audit / analysis we display or
// persist must be for the workspace's configured domain. If the backend ever
// returns the wrong tenant's run (network blip, cache mixup, regression), the
// dashboard drops it instead of leaking to the user or poisoning the local
// saved-run cache.

export function normalizeHost(s: string | null | undefined): string {
  if (!s) return "";
  return String(s)
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

export function sameDomain(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const na = normalizeHost(a);
  const nb = normalizeHost(b);
  return na !== "" && na === nb;
}
