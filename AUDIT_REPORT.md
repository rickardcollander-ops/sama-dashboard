# SAMA Customer Portal — UX/UI & Functionality Audit Report

## Sammanfattning

Genomgång av alla 11 kundsidor + delad kod. Hittade **5 kritiska buggar**, **5 API-mismatches**, 
**9 UX-förbättringar** och **6 funktionalitetsluckor**. Kritiska buggar fixas i denna commit.

---

## Per sida

### /c/login
**Status:** Fungerar
**Fixat nu:**
- Auto-switch till login-läge efter lyckad signup

**UX-förbättringar (framtida):**
- Lösenordskrav borde visas (min 6 tecken etc.)
- "Glömt lösenord"-länk saknas
- Laddar-indikator på knappen borde vara tydligare (spinner-ikon)

---

### /c/onboarding
**Status:** Fungerar med fix
**Fixat nu:**
- X-knapp för att stänga/hoppa över
- "Kör onboarding"-knapp i Settings

**UX-förbättringar (framtida):**
- Steg 1 och 3 har ingen validering — man kan skippa konkurrenter och reviews
- GEO-queries borde kunna ställas in här (nu sätts de till tom array)
- Progressbar borde visa vilka steg som är ifyllda vs tomma
- Felmeddelande om spara-anropet misslyckas (nu tyst fail)

---

### /c/dashboard
**Status:** Fungerar med fix
**Fixat nu:**
- Använder tenantApi istället för råa fetch (tenant-isolering)
- Error-banner med detaljerade felmeddelanden
- Undefined `err` variabel fixad

**UX-förbättringar (framtida):**
- Skeleton loaders istället för spinner
- Statistik-korten borde vara klickbara (navigera till respektive sida)
- "Senaste aktivitet"-sektion saknas
- Snabbknappar för vanliga åtgärder (kör SEO-audit, generera content)

---

### /c/seo
**Status:** Fungerar
**Fixat nu:**
- Tenant-filtrering i backend (såg Successifier-data förut)
- Null-guards på toLocaleString
- Error-banner med detaljer

**UX-förbättringar (framtida):**
- Position history-chart visar ingenting om data saknas — borde visa "Ingen historik ännu"
- Keyword-tabellen borde vara sorterbar (klicka på kolumnrubriker)
- Bulk-delete av keywords
- Export till CSV

---

### /c/content
**Status:** Fixad
**Fixat nu:**
- API-path: `/api/content/library` → `/api/content/pieces`
- Save-draft: `/api/content/save-draft` → `/api/content/pieces` (POST)
- Modal reset vid stängning (topic + content nollställs)
- Error-meddelanden vid fel

**UX-förbättringar (framtida):**
- Preview av content i card borde vara längre (nu 2 rader)
- Redigera existerande drafts inline
- Statusbyte-knappar (Draft → Approved → Archived)
- Word count-beräkning inkluderar whitespace — bör använda `.split(/\s+/).filter(Boolean).length`

---

### /c/social
**Status:** Fixad
**Fixat nu:**
- Undefined `err` i Promise.allSettled-hanterare (byggfel)
- Error-banner

**UX-förbättringar (framtida):**
- Ingen "Skapa ny post"-funktion
- Engagement-metrics borde ha sparklines/trend-pilar
- Plattformsfilter (bara visa X / bara LinkedIn)
- Pagination vid många poster

---

### /c/ads
**Status:** Fixad
**Fixat nu:**
- Brand-kontext laddas automatiskt från user_settings
- Annonsförslag anpassade efter kundens varumärke, målgrupp, konkurrenter
- Konkurrentanalys-sektion
- Screenshot-fältnamn: `image` → `image_base64` (matchade backend)
- DELETE-endpoint i backend tillagd
- Undefined `err` fixad
- Error-meddelanden på alla operationer

**UX-förbättringar (framtida):**
- Bekräftelsedialog innan delete av draft
- Analysresultat borde ha stäng-knapp
- Character limit borde använda `maxLength`-attribut
- Format-val borde påverka character limits
- Kopiera-knapp på genererad text

---

### /c/analytics
**Status:** Fungerar
**Fixat nu:**
- Null-guards på toLocaleString
- Error-banner

**UX-förbättringar (framtida):**
- Ingen refresh-knapp (finns i SEO/GEO men inte här)
- Datumväljare för tidsperiod
- Export till PDF/CSV
- Jämförelse med föregående period

---

### /c/geo
**Status:** Fungerar
**Fixat nu:**
- Egen kundsida (importerade admin-sidan innan)
- Tenant-filtrering
- Error-banner med detaljer

**UX-förbättringar (framtida):**
- Tom state borde vara mer hjälpsam ("Definiera GEO-frågor i Inställningar")
- Top competitors-sektion visas även utan data
- Trend-grafer över tid

---

### /c/settings
**Status:** Fungerar
**Fixat nu:**
- Google status false-positive fixad (sätter false vid fel)
- Annonsplattformskopplingar tillagda
- "Kör onboarding"-knapp

**UX-förbättringar (framtida):**
- Success-toast vid spara borde vara tydligare
- Sektioner borde vara kollapsade by default (lång sida)
- Validering av API-nycklar format
- "Testa anslutning"-knapp för varje integration

---

### /c/pricing
**Status:** UI only
**Problem:**
- CTA-knappar går till /c/login (funkar inte om redan inloggad)
- Ingen faktisk betalningsintegration

**UX-förbättringar (framtida):**
- CTA borde gå till /c/dashboard eller checkout
- Stripe-integration
- Feature-jämförelsetabell
- "Nuvarande plan"-indikator

---

### Navigation (CustomerNav)
**Status:** Fungerar
**Fixat nu:**
- Rätt ordning: Dashboard → SEO → Content → Social → Ads → Analytics → GEO → Settings

**UX-förbättringar (framtida):**
- Aktiv sida borde vara tydligare markerad
- Badge/notifikation-counters på nav items
- Mobil-nav kan overflow på små skärmar

---

## Delad kod

### lib/api.ts
**Fixat nu:**
- Timeout: 15s → 10s
- Retries: 2 → 1
- Felmeddelanden inkluderar status + response body

### lib/hooks/useUser.ts
**Fixat nu:**
- Använder @supabase/ssr istället för supabase-js

**Problem kvar:**
- Om Supabase inte är konfigurerat returnerar hooken `loading: false, user: null` tyst

### middleware.ts
**Status:** Fungerar men deprecated i Next.js 16
**Framtida:** Byt till `proxy.ts` (Next.js 16 convention)

---

## Prioriteringsordning för framtida förbättringar

### P0 — Innan säljstart
1. Stripe-integration i pricing
2. Lösenordsåterställning i login
3. Skeleton loaders på alla sidor
4. Bekräftelsedialog vid delete

### P1 — Första veckan
5. Export/download-funktion (CSV/PDF)
6. Sortering i tabeller
7. Datumväljare i analytics
8. "Glömt lösenord" i login
9. Byta middleware.ts → proxy.ts

### P2 — Första månaden
10. Inline-redigering av content drafts
11. Bulk-actions (select multiple, delete)
12. Sparklines/trendpilar i stats
13. Notifikation-badges i nav
14. Request abort on unmount (memory leak prevention)
