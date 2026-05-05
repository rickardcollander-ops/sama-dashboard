/**
 * Admin gating for SAMA dashboard.
 *
 * The admin portal at /c/admin and its API endpoints under /api/admin/* are
 * restricted to the operator email below. The check is enforced server-side
 * in every admin API route (see requireAdmin); the client-side flag is only
 * used to decide whether to render UI affordances.
 */

export const ADMIN_EMAIL = "rc@successifier.com";

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
}
