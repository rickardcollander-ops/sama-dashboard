# SAMA Customer Portal (sama.successifier.com)

Standalone Next.js app that customers log into. Lives in `customer/` as a
self-contained project so it can be deployed to its own Vercel project,
independent of the admin dashboard at the repo root.

## Local development

```bash
cd customer
npm install
cp .env.example .env.local   # fill in NEXT_PUBLIC_SUPABASE_* and NEXT_PUBLIC_SAMA_API_URL
npm run dev
```

Open http://localhost:3000 — the proxy will redirect you to `/login`.

## Vercel setup

Create a **second** Vercel project on the same `sama-dashboard` repo:

1. New Project → import `rickardcollander-ops/sama-dashboard`
2. **Root Directory:** `customer`
3. Framework: Next.js (auto-detected)
4. Environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SAMA_API_URL` (the sama-agent backend URL)
5. Domains: add `sama.successifier.com` and point a CNAME at
   `cname.vercel-dns.com`.

The admin dashboard project at the repo root keeps deploying as before;
its `proxy.ts` redirects any old `/c/*` URL to the new subdomain so
existing bookmarks still work.
