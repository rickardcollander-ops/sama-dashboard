/**
 * Telemarketing portal gating.
 *
 * `/tm` is an external surface for operators who only need to work a
 * telemarketing campaign list — log in, see the campaigns, update call
 * statuses and notes. It's intentionally separate from `/c/admin` so a
 * non-admin TM user can be invited without seeing the rest of the
 * dashboard.
 *
 * Allowlist is server-side via `TM_USER_EMAILS` (comma-separated, case
 * insensitive). The hardcoded admin email always has access too.
 *
 * Note: process.env.TM_USER_EMAILS is server-only and evaluates to
 * undefined in browser bundles, so this module must only be imported
 * from server code or API routes.
 */
import { isAdminEmail } from "./admin";

export function isTmEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  if (isAdminEmail(email)) return true;
  const allowed = (process.env.TM_USER_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.trim().toLowerCase());
}
