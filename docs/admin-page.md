# Admin page

The admin page lives at `/c/admin` and is gated to the operator email
`rc@successifier.com`. It uses the existing Supabase Auth session — sign
in at `/c/login` with that email and the **Admin** link appears in the
top navigation.

## What it shows

- All Supabase auth users with email, ID, created date, last sign-in,
  email confirmation status
- Brand name and domain pulled from `user_settings` (joined client-side
  in the API)
- Counters for total / confirmed / onboarded users

## What it does

- **Invite** — sends a Supabase invitation email to a new address
- **Reset** — sends a password reset email to the selected user
- **Delete** — removes the auth user (and cascades through `user_settings`
  via the existing FK)

The admin cannot delete their own account, and any account whose email
matches `ADMIN_EMAIL` is also blocked from deletion as a safety net.

## Required env vars

All admin endpoints require **`SUPABASE_SERVICE_ROLE_KEY`** in addition
to the public Supabase URL/anon key already used by the dashboard. The
service role key is read server-side only via `lib/supabase-admin.ts` and
is never sent to the browser.

Without the service role key the API returns 503 with a helpful message;
the page itself still loads.

## Files

| Path | Purpose |
| --- | --- |
| `lib/admin.ts` | `ADMIN_EMAIL` constant + `isAdminEmail` helper |
| `lib/supabase-admin.ts` | Service-role Supabase client (server only) |
| `lib/admin-guard.ts` | `requireAdmin()` for API routes |
| `app/api/admin/accounts/route.ts` | `GET` list, `POST` invite |
| `app/api/admin/accounts/[id]/route.ts` | `DELETE` user |
| `app/api/admin/accounts/[id]/reset-password/route.ts` | `POST` reset |
| `app/c/admin/page.tsx` | Admin UI |
| `components/CustomerNav.tsx` | Conditional Admin link |
