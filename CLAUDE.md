# sama-dashboard

Next.js frontend for the SAMA platform. Proxies all AI/data calls to the SAMA backend
(configured via `SAMA_API_URL`). All backend endpoints below must exist on that backend.

## Architecture

```
Browser → Next.js (/api/sama/[...path]) → SAMA backend (Railway)
Vercel crons → Next.js cron routes → SAMA backend (direct, bypasses proxy)
```

The proxy at `app/api/sama/[...path]/route.ts` validates Supabase auth, strips
client-supplied tenant headers, and re-injects server-resolved `X-Sama-Account-Id`
and `X-Sama-Site-Id` before forwarding.

## Content Autopilot — Backend Contract

Two cron jobs call the content agent. The backend endpoint **must** support all
parameters below.

### Endpoint

```
POST /api/tenant/agents/content/trigger
X-Tenant-ID: <user_id>          ← set by cron routes directly
X-Sama-Intent: user-action
```

### Parameters

| Field                    | Type    | Default | Description |
|--------------------------|---------|---------|-------------|
| `source`                 | string  | —       | `"daily_cron"` / `"weekly_cron"` / `"manual"` |
| `ideas_per_run`          | number  | 6       | Ideas to generate |
| `auto_draft_top_n`       | number  | 3       | Immediately draft the top N ideas (LLM article generation) |
| `auto_publish`           | boolean | false   | Publish drafts that meet score threshold |
| `min_score_for_publish`  | number  | 70      | Score threshold (0–100) for auto-publish |
| `scheduled_for_days_ahead` | number | —     | Schedule the drafted article N days from today. **Required for daily_cron.** |

### Daily cron — `app/api/integrations/cron/daily-content/route.ts`

Runs every day at 06:00 Europe/Stockholm for all onboarded users (skips users
whose `onboarding_completed_at` is < 30 days ago — they already have a 30-day
plan from onboarding).

```json
{
  "source": "daily_cron",
  "ideas_per_run": 1,
  "auto_draft_top_n": 1,
  "auto_publish": <site content_autopilot.auto_publish>,
  "min_score_for_publish": <site setting, default 70>,
  "scheduled_for_days_ahead": 2
}
```

`auto_publish` is **not** hardcoded — it's read from the site's
`content_autopilot.auto_publish` toggle (the per-site mode selector). `true` = fully
automatic (auto-approve + auto-publish on the scheduled date); `false` = draft into the
approval queue for human review.

**Expected behaviour:** Generate 1 idea, draft it, pin `scheduled_for` to today + 2 days.
The backend should skip (return 200 with `{ skipped: true }`) if there is already a
scheduled or draft article for that date — gap-filling, not blind generation.

### Weekly autopilot — `app/api/integrations/cron/weekly-agents/route.ts`

Runs every Monday 07:30 Europe/Stockholm. Only fires for users where
`user_settings.settings.content_autopilot.enabled === true`.
Respects `cadence: "biweekly"` (odd ISO weeks only).

```json
{
  "source": "weekly_cron",
  "ideas_per_run": 6,
  "auto_draft_top_n": 3,
  "auto_publish": false,
  "min_score_for_publish": 70
}
```

### Expected response

```json
{ "run_id": "...", "status": "running" }
```

Work happens async. The frontend polls `/api/content/pieces` and
`/api/content/plan?status=idea` to surface results.

### Publishing (owned by the dashboard)

The dashboard is the **single publisher**. The 5-min cron
(`/api/integrations/cron` → `lib/integrations/auto-publish-bridge.ts`) ingests backend
calendar rows whose `piece_status === "approved"` and whose `scheduled_for <= now`, then
ships each article to that site's own destination in
`user_sites.settings.publishing_destinations[]` (CMS adapter or GitHub), and PATCHes the
backend piece to `published` for idempotency. The bridge is gated only on
`content_autopilot.enabled` (not `auto_publish`) so both modes publish:

- **Fully automatic:** the backend auto-approves passing drafts → they publish on the
  scheduled date.
- **Review-first:** drafts wait in `/c/approvals`; approving flips the piece to
  `approved` + `scheduled_for=now` → the bridge publishes within ~5 min.

The backend's own GitHub publish (`process_due_scheduled_items`) is disabled to prevent
double-publishing.

## Content Plan API

```
GET  /api/content/plan?status=idea    → { items: PlanIdea[] }
POST /api/content/plan/calendar       → create/update plan items
POST /api/content/plan/{id}/draft     → convert idea to draft (async LLM)
```

`PlanIdea` shape used by the dashboard `ContentPipeline` component:
```typescript
{ id: string; title: string; content_type?: string; scheduled_for?: string | null }
```

## Cron Schedule (vercel.json)

| Path | Schedule | Purpose |
|------|----------|---------|
| `/api/integrations/cron` | `*/5 * * * *` | Publish scheduled items |
| `/api/integrations/cron/weekly-agents` | `30 5 * * 1` + `30 6 * * 1` | Weekly agents + autopilot (DST dual-schedule) |
| `/api/integrations/cron/daily-content` | `0 4 * * *` + `0 5 * * *` | Daily content fill (DST dual-schedule) |

All cron routes authenticate with `Authorization: Bearer {CRON_SECRET}`.
