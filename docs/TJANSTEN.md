# SAMA 2.0 Dashboard — Sammanfattning av tjänsten

SAMA 2.0 Dashboard är ett kommandocentrum för **autonoma marknadsagenter** som
sköter Successifiers tillväxt. Plattformen kombinerar realtidsdata från Google
Search Console, Google Ads, sociala kanaler och recensionsplattformar med en
flotta av AI-agenter som föreslår, schemalägger och utför åtgärder.

## Helhetsbild

- **Frontend**: Next.js 16 (App Router), TypeScript, Tailwind, Lucide.
- **Datalager**: Supabase (Postgres) — agent-actions, alerts, keywords,
  content, reviews m.fl.
- **Backend / agentlager**: SAMA 2.0 API (`/api/sama/*` proxy → extern Vercel-tjänst).
- **Orkestrering**: Paperclip kör företagshierarki (CEO, CMO, CFO, …) som
  i sin tur delegerar marknadsuppdrag till SAMA-agenterna.
- **Realtid**: Supabase Realtime-prenumeration på `agent_actions` och `alerts`,
  med polling som fallback.

## Startsidan — Command Center (`/`)

- **Marketing Score** (0–100) med transparent breakdown över SEO-keywords,
  content, recensioner, audits, scheduler-status och snittbetyg.
- **KPI-rad**: snittposition, klick (28 d), CTR, antal keywords, snittbetyg.
- **Smart Recommendations**: AI-genererade prioriterade rekommendationer
  (high/medium/low) per agent, med impact- och effort-bedömning.
- **Agent-grid**: en kort kort per agent med "Open Dashboard" + "Run"-knapp,
  pending-räknare och scheman-status.
- **Autonomous Schedule**: visar nästa körning, senaste status och eventuella
  fel för alla schemalagda jobb.
- **Pending Alerts-banner** länkar direkt till `/approvals`.
- **Run All**-knapp triggar alla agenter (utom LinkedIn) sekventiellt.

## Agenterna

| Agent | Syfte | Endpoint | Schema |
|-------|-------|----------|--------|
| **SEO** | Keyword-rankings, tekniska audits, Core Web Vitals | `POST /api/automation/trigger/seo-audit` | dagligen + veckoaudit |
| **Content** | Gap-analys, blog- och jämförelsesidor | `POST /api/content/analyze` | onsdagar |
| **Ads** | Google Ads-kampanjer, bid- och annonsoptimering | `POST /api/ads/analyze` | dagligen |
| **Social** | Twitter/X-bevakning, postgenerering, replies | `POST /api/automation/daily-workflow` | daily workflow |
| **Reviews** | G2, Capterra, Trustpilot — bevakning + svar | `POST /api/reviews/analyze` | midday + daily |
| **Analytics** | Tvärkanalig attribution & ROI-rapportering | `GET /api/analytics/report/weekly` | dagligen |
| **AI Visibility** | Mätning av nämn i ChatGPT/Claude/Gemini/Perplexity | `POST /api/ai-visibility/check` | torsdagar |

Alla agenter kan köras manuellt från startsidan eller från sin egen
detaljsida, och rapporterar tillbaka via `agent_actions`-tabellen.

## Sidor i dashboarden

### Operativa kanaler
- **`/seo`** — Keyword-rankings, tekniska audits, content-actions och
  strategikarta.
- **`/ads`** — Kampanjöversikt med bid-, copy- och budgetrekommendationer.
- **`/content`** — Content-bibliotek med pillar-struktur, gap-analys och
  AI-genererade artiklar/jämförelsesidor.
- **`/social`** — Tweet-generering, Reddit-bevakning och engagemangs­analys.
- **`/linkedin`** — Thought leadership-poster med stilval och schemaläggning.
- **`/reviews`** — Recensioner från fem plattformar med SLA-kontroll och
  konkurrentinsikter.

### Analys & insikt
- **`/analytics`** — Tvärkanaliga mätvärden, attribution, konverterings­tratt.
- **`/content-analytics`** — Topp/bottensidor med engagemang och förbättrings­förslag.
- **`/ai-visibility`** — Mätning av varumärkets synlighet i AI-assistenter.
- **`/anomalies`** — Statistisk avvikelsedetektering med root-cause-analys.
- **`/budget-optimizer`** — Omfördelning av annonsbudget baserat på ROAS/CPA.
- **`/gtm`** — Go-to-market: ICP, positionering, köpsignaler, pipeline.

### Styrning & operations
- **`/approvals`** — Kö för åtgärder som kräver manuell godkännande.
- **`/agent-chat`** — Teamchatt med specialiserade agenter
  (NOVA, APEX, MUSE, ECHO, SENTINEL, ORACLE).
- **`/agent-reports`** — Veckorapporter per agent: utförda actions, problem,
  förbättringar.
- **`/leads`** — Lead-pipeline från ny kontakt till konvertering.
- **`/goals`** — Mål-hierarki som agenterna jobbar mot.
- **`/system-health`** — Hälsa för API:er, databas, scheduler och agenter.
- **`/logs`** — Full körhistorik med filter på agent, status och fritext.

## Kommersiell yta — kundportal `/c/*`

Plattformen är förberedd för SaaS-drift:

| Route | Funktion |
|-------|----------|
| `/c/pricing` | Tre pristier: Starter $149/mo, Growth $399/mo, Enterprise |
| `/c/onboarding` | 5-stegs setup (varumärke, konkurrenter, API-nycklar, recensioner, launch) |
| `/c/dashboard` | Kundens command center — redirectar till onboarding om `brand_name` saknas |
| `/c/seo`, `/c/content`, `/c/social`, `/c/analytics` | Tenant-specifika versioner av huvudvyerna |

Multi-tenancy hanteras via `tenantApi(user.id)` som injicerar
`X-Tenant-ID`-header mot SAMA-backend.

## Datakällor

- **Supabase-tabeller**: `agent_actions`, `alerts`, `audit_leads`,
  `public_audits`, `user_settings`, `user_sites`, `account_members`.
- **Externa integrationer**: Google Search Console, Google Ads,
  Google Analytics, Twitter/X, LinkedIn, G2, Capterra, Trustpilot,
  ChatGPT/Claude/Gemini/Perplexity (AI Visibility).

## Kort om värdet

SAMA Dashboard ger en grundare eller marknadsteam ett enda gränssnitt för
att **se vad som händer**, **godkänna förslag** och **trigga eller schemalägga**
autonoma marknadsåtgärder över sju kanaler — utan att själv behöva växla
mellan GSC, Ads-konsolen, Twitter, recensions­sajter och AI-assistenter.
