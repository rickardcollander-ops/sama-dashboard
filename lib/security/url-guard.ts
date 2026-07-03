/**
 * SSRF guard for server-side fetches of user-controlled URLs (CMS
 * destinations, domain scrapers, etc.).
 *
 * `assertPublicHttpUrl` parses the given string and throws unless it looks
 * like a URL a browser could legitimately reach on the public internet:
 * http/https only, no loopback/link-local/RFC1918/unique-local addresses,
 * no bare metadata host, and no obvious TLD-less internal hostname.
 *
 * This is intentionally NOT a DNS-resolution-based guard (no `dns.lookup`
 * calls) — it only inspects the literal hostname in the URL. A determined
 * attacker who controls DNS for a public-looking domain could still point
 * it at an internal IP (classic "DNS rebinding"); guarding against that
 * requires resolving + pinning the IP at fetch time, which is out of scope
 * here. This guard blocks the common, low-effort SSRF payloads: literal
 * IPs, localhost, cloud metadata hostnames, and single-label hostnames.
 */

const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

function isPrivateIPv4(host: string): boolean {
  const m = host.match(IPV4_RE);
  if (!m) return false;
  const parts = m.slice(1, 5).map(Number);
  if (parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return false;
  const [a, b] = parts;
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local
  if (a === 0) return true; // 0.0.0.0/8 ("this network" / unroutable)
  return false;
}

function normalizeIPv6(raw: string): string {
  let h = raw.trim().toLowerCase();
  if (h.startsWith("[") && h.endsWith("]")) h = h.slice(1, -1);
  return h;
}

/** Returns the numeric value of the first hextet, or null if unparseable. */
function ipv6FirstHextetValue(h: string): number | null {
  const firstGroup = h.split(":")[0];
  if (firstGroup === "") return 0; // address starts with "::"
  if (!/^[0-9a-f]{1,4}$/.test(firstGroup)) return null;
  return parseInt(firstGroup, 16);
}

function isPrivateIPv6(host: string): boolean {
  const h = normalizeIPv6(host);
  if (!h.includes(":")) return false;
  if (h === "::1" || h === "0:0:0:0:0:0:0:1") return true; // loopback
  if (h === "::" || h === "0:0:0:0:0:0:0:0") return true; // unspecified
  const first = ipv6FirstHextetValue(h);
  if (first === null) return false;
  if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 unique-local
  return false;
}

const BLOCKED_HOSTS = new Set(["metadata.google.internal", "metadata"]);

/**
 * Parses `raw` as an http(s) URL and throws an Error unless it is safe to
 * fetch from the server. Returns the parsed `URL` on success so callers can
 * reuse it (e.g. for a normalized base).
 */
export function assertPublicHttpUrl(raw: string): URL {
  const input = (raw || "").trim();
  if (!input) throw new Error("URL is required");

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error(`Invalid URL: ${input}`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`URL must use http or https: ${input}`);
  }

  const rawHost = url.hostname.toLowerCase();
  const bracketed = rawHost.startsWith("[") && rawHost.endsWith("]");
  const host = bracketed ? rawHost.slice(1, -1) : rawHost;

  if (!host) throw new Error(`URL has no host: ${input}`);

  if (host === "localhost" || host.endsWith(".localhost")) {
    throw new Error(`URL host is not allowed (localhost): ${input}`);
  }
  if (BLOCKED_HOSTS.has(host)) {
    throw new Error(`URL host is not allowed (metadata service): ${input}`);
  }
  if (host === "0.0.0.0") {
    throw new Error(`URL host is not allowed (0.0.0.0): ${input}`);
  }

  if (IPV4_RE.test(host)) {
    if (isPrivateIPv4(host)) {
      throw new Error(`URL host is a private/internal IP address: ${input}`);
    }
    return url;
  }

  if (host.includes(":")) {
    // IPv6 literal.
    if (isPrivateIPv6(host)) {
      throw new Error(`URL host is a private/internal IPv6 address: ${input}`);
    }
    return url;
  }

  // A plain DNS name. We don't resolve DNS here, but a hostname with no dot
  // at all (no TLD, e.g. "intranet", "printer") is almost always an
  // internal-network name and never a legitimate public destination.
  if (!host.includes(".")) {
    throw new Error(`URL host looks like an internal hostname: ${input}`);
  }

  return url;
}
