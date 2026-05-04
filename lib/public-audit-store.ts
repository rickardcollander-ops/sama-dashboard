import { createServerClient } from "@supabase/ssr";
import type { AuditResult } from "@/components/analysis/PublicAuditResult";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function adminClient() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return null;
  return createServerClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    cookies: { getAll: () => [], setAll: () => {} },
  });
}

function anonClient() {
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (!SUPABASE_URL || !anon) return null;
  return createServerClient(SUPABASE_URL, anon, {
    cookies: { getAll: () => [], setAll: () => {} },
  });
}

const ID_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789"; // no 0/o/l/1
function shortId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ID_ALPHABET[b % ID_ALPHABET.length]).join("");
}

/**
 * Saves a public audit run. Returns the new id, or null if Supabase isn't
 * configured — the caller should still return the audit so the UI works
 * locally without persistence.
 */
export async function savePublicAudit(result: Omit<AuditResult, "id">): Promise<string | null> {
  const admin = adminClient();
  if (!admin) return null;
  const id = shortId();
  const { error } = await admin
    .from("public_audits")
    .insert({ id, domain: result.domain, payload: result });
  if (error) {
    console.error("[public-audit] save failed:", error.message);
    return null;
  }
  return id;
}

export async function loadPublicAudit(id: string): Promise<AuditResult | null> {
  if (!/^[a-z0-9]{8,32}$/i.test(id)) return null;
  const client = anonClient();
  if (!client) return null;
  const { data, error } = await client
    .from("public_audits")
    .select("id, domain, payload, created_at")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  const payload = data.payload as AuditResult;
  return { ...payload, id: data.id };
}
