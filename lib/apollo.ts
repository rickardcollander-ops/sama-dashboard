/**
 * Apollo CSV import helpers.
 *
 * Apollo's "Export contacts" CSV column names drift between releases and
 * between Search vs. Sequence exports, so we accept a handful of synonyms
 * for each field. Anything we don't recognise is preserved in `raw` so the
 * UI can still show it on the call sheet.
 */

export interface ApolloLeadRow {
  company_name: string;
  domain: string | null;
  contact_first_name: string | null;
  contact_last_name: string | null;
  contact_title: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  industry: string | null;
  company_size: string | null;
  city: string | null;
  country: string | null;
  linkedin_url: string | null;
  raw: Record<string, string>;
}

const FIELD_SYNONYMS: Record<keyof Omit<ApolloLeadRow, "raw">, string[]> = {
  company_name: [
    "company", "company name", "account", "account name", "organization",
    "organization name", "employer",
  ],
  domain: [
    "website", "company website", "domain", "company domain", "url",
    "company url", "website url",
  ],
  contact_first_name: ["first name", "first", "given name", "firstname"],
  contact_last_name: ["last name", "last", "family name", "surname", "lastname"],
  contact_title: [
    "title", "job title", "position", "role", "person title",
  ],
  contact_email: [
    "email", "email address", "work email", "personal email", "primary email",
  ],
  contact_phone: [
    "phone", "phone number", "mobile", "mobile number", "work phone",
    "direct phone", "company phone", "contact phone",
  ],
  industry: ["industry", "company industry", "sector", "vertical"],
  company_size: [
    "# employees", "employees", "company size", "employee count", "headcount",
    "num employees", "# of employees",
  ],
  city: ["city", "person city", "company city"],
  country: ["country", "person country", "company country"],
  linkedin_url: [
    "person linkedin url", "linkedin", "linkedin url", "linkedin profile",
    "company linkedin url",
  ],
};

/**
 * Strip protocol, paths and the leading "www." from a URL/host string and
 * return the bare host in lowercase. Rejects localhost and obvious junk.
 * Returns null when the input doesn't look like a domain.
 */
export function normalizeDomain(input: string | null | undefined): string | null {
  if (!input) return null;
  const raw = input.trim();
  if (!raw) return null;
  let host = raw;
  // Strip protocol if present
  host = host.replace(/^[a-z]+:\/\//i, "");
  // Strip user:pass@
  host = host.replace(/^[^@/]+@/, "");
  // Strip port + path + query + hash
  host = host.split(/[/?#]/)[0];
  // Strip leading www.
  host = host.replace(/^www\./i, "");
  host = host.toLowerCase();
  if (!host) return null;
  if (host === "localhost" || host.endsWith(".localhost")) return null;
  // Must contain a dot and a TLD-like suffix (2+ chars).
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host)) return null;
  return host;
}

/**
 * Minimal RFC-4180-ish CSV parser. Handles quoted fields, escaped quotes
 * (""), CRLF or LF line endings, and a UTF-8 BOM. Returns a list of rows
 * (each row is an array of cell strings).
 *
 * Apollo CSVs can include commas and newlines inside quoted cells (job
 * descriptions, addresses), so we can't just `.split(",")`.
 */
export function parseCsv(text: string): string[][] {
  // Strip UTF-8 BOM if present
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      cell += c; i++; continue;
    }

    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ",") { row.push(cell); cell = ""; i++; continue; }
    if (c === "\r") { i++; continue; } // swallow — the LF will close the row
    if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; i++; continue; }
    cell += c; i++;
  }
  // Last cell / row
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

interface HeaderMap {
  /** field key → CSV column index */
  fields: Partial<Record<keyof Omit<ApolloLeadRow, "raw">, number>>;
  /** original header label per column index, for `raw` */
  labels: string[];
}

function buildHeaderMap(headers: string[]): HeaderMap {
  const labels = headers.map((h) => h.trim());
  const fields: HeaderMap["fields"] = {};
  const lcLabels = labels.map((l) => l.toLowerCase());
  for (const [field, synonyms] of Object.entries(FIELD_SYNONYMS) as [
    keyof Omit<ApolloLeadRow, "raw">, string[],
  ][]) {
    for (const syn of synonyms) {
      const idx = lcLabels.indexOf(syn);
      if (idx >= 0) { fields[field] = idx; break; }
    }
  }
  return { fields, labels };
}

export interface ParseResult {
  rows: ApolloLeadRow[];
  /** Rows we couldn't keep, with the row-index (1-based, header counted) and reason. */
  skipped: { rowIndex: number; reason: string }[];
  /** Column header → field name (for the import preview). */
  detectedColumns: Record<string, keyof Omit<ApolloLeadRow, "raw"> | null>;
}

/**
 * Parses a raw Apollo CSV string into normalized lead rows.
 * Drops rows missing both a company name and a domain — there's nothing
 * useful we can run an audit on.
 */
export function parseApolloCsv(text: string): ParseResult {
  const grid = parseCsv(text);
  if (grid.length < 2) {
    return { rows: [], skipped: [], detectedColumns: {} };
  }
  const [header, ...dataRows] = grid;
  const map = buildHeaderMap(header);

  const detectedColumns: ParseResult["detectedColumns"] = {};
  for (const [i, label] of map.labels.entries()) {
    const matched = (Object.keys(map.fields) as (keyof Omit<ApolloLeadRow, "raw">)[])
      .find((k) => map.fields[k] === i);
    detectedColumns[label] = matched ?? null;
  }

  const rows: ApolloLeadRow[] = [];
  const skipped: ParseResult["skipped"] = [];

  dataRows.forEach((cells, idx) => {
    // Skip blank lines
    if (cells.every((c) => !c?.trim())) return;

    const get = (k: keyof Omit<ApolloLeadRow, "raw">): string | null => {
      const i = map.fields[k];
      if (i === undefined) return null;
      const v = (cells[i] ?? "").trim();
      return v || null;
    };

    const companyName = get("company_name");
    const rawDomain = get("domain");
    const domain = normalizeDomain(rawDomain);

    if (!companyName && !domain) {
      skipped.push({ rowIndex: idx + 2, reason: "missing both company name and domain" });
      return;
    }

    const raw: Record<string, string> = {};
    map.labels.forEach((label, i) => {
      const v = (cells[i] ?? "").trim();
      if (v) raw[label] = v;
    });

    rows.push({
      company_name: companyName ?? domain!,
      domain,
      contact_first_name: get("contact_first_name"),
      contact_last_name: get("contact_last_name"),
      contact_title: get("contact_title"),
      contact_email: get("contact_email"),
      contact_phone: get("contact_phone"),
      industry: get("industry"),
      company_size: get("company_size"),
      city: get("city"),
      country: get("country"),
      linkedin_url: get("linkedin_url"),
      raw,
    });
  });

  return { rows, skipped, detectedColumns };
}

/**
 * Returns the HMAC key used for PDF render tokens. Prefers the dedicated
 * PDF_SIGNING_SECRET, but falls back to SUPABASE_SERVICE_ROLE_KEY — both
 * sit at the same trust level (anyone with either can read any lead's
 * report), and the service-role key is always present in any working
 * dashboard deployment. Lets us ship without a separate env var.
 */
function pdfSigningSecret(): string {
  return process.env.PDF_SIGNING_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

/**
 * HMAC-SHA256 of `${leadId}|${exp}`. Used to gate the public PDF render
 * route so Playwright (which runs without a logged-in cookie) can fetch it
 * from sama-agent without exposing customer data on a permanent unauth URL.
 */
export async function signPdfToken(leadId: string, ttlSeconds = 600): Promise<string> {
  const secret = pdfSigningSecret();
  if (!secret) throw new Error("PDF_SIGNING_SECRET (or SUPABASE_SERVICE_ROLE_KEY) not configured");
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${leadId}|${exp}`;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  const sigB64 = Buffer.from(sig).toString("base64url");
  return `${exp}.${sigB64}`;
}

export async function verifyPdfToken(leadId: string, token: string): Promise<boolean> {
  const secret = pdfSigningSecret();
  if (!secret || !token) return false;
  const [expStr, sig] = token.split(".");
  const exp = Number(expStr);
  if (!exp || !sig) return false;
  if (exp < Math.floor(Date.now() / 1000)) return false;
  const payload = `${leadId}|${exp}`;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const want = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  const wantB64 = Buffer.from(want).toString("base64url");
  // Constant-time compare
  if (wantB64.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < wantB64.length; i++) diff |= wantB64.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}
