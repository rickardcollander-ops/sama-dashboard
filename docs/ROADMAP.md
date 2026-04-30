# SAMA Dashboard – Åtgärdsplan för säljbar produkt

**Granskat:** sama-dashboard-alpha.vercel.app (Dashboard, SEO, Content, Social, Ads, Analytics, GEO Monitor, Settings, Plan)
**Datum:** 2026-04-30
**Branch:** `claude/sama-dashboard-review-nytsQ`

---

## Sammanfattning

Produkten har en bra grundstruktur (sju agenter, multi-platform GEO-monitorering, ROI-tänk i Analytics, tydlig prismodell). Det som saknas för att den ska kunna säljas är inte fler funktioner – utan att den ser och beter sig som en färdig SaaS:

1. **Kunden ska aldrig se sin egen LLM-nyckel.** Idag måste man fylla i OpenAI/Anthropic/Perplexity/SerpAPI-nycklar i Settings. Det är en showstopper.
2. **Tomma states känns trasiga, inte nya.** Alla flikar visar "0" och "No data" utan vägledning, demo-data eller nästa steg.
3. **Grafiken är funktionell men neutral.** Det finns inget i UI:t som signalerar "premium-produkt värd 399 USD/mån".
4. **Onboarding är osynlig.** Det finns en "Run Onboarding"-knapp i Settings men ingen guidad förstaupplevelse.

En central nyhet är **P2.9 – Kombinerad SEO + GEO-analys**, som kopplar ihop SEO-agenten och GEO Monitor till en gemensam analysvy. Det är produktens potentiellt starkaste differentiering mot Semrush/Ahrefs (klassisk SEO) och AthenaHQ/Profound (rena GEO-verktyg) – ingen av dem visar Google-rank och AI-mention sida vid sida med åtgärdsförslag.

---

## Prioritet 0 – Blockerare för försäljning (måste lösas först)

### P0.1 – Ta bort kundens beroende av LLM-nycklar
**Vad:** Flytta OpenAI-, Anthropic-, Perplexity- och SerpAPI-nycklar från kundens Settings till en serverside-konfiguration som ni betalar för centralt.
**Vad det löser:** En ICP-kund (marknadschef på B2B SaaS) kommer aldrig sätta upp ett OpenAI-konto, generera en `sk-…`-nyckel och klistra in den.
**Klart när:** Settings-sidan visar inte en enda rånyckel. Token-budget per plan i admin-vyn.

### P0.2 – Ta bort "Stop Claude"-debug-knapp på /c/geo
**Vad:** Knappen syns i nedre hörnet på GEO-sidan (sannolikt en dev-overlay).
**Klart när:** Inget i prod heter "Stop Claude".

### P0.3 – Dölj eller fixa "Failed"-rader i Recent Runs
**Vad:** Settings → Recent Runs visar två "seo Failed"-rader från 2 april.
**Klart när:** Failed-rader länkar till en åtgärd (Re-run/Reconnect), eller döljs när orsaken inte är aktuell.

### P0.4 – Konsekvent språkhantering
**Vad:** Brand-språket är "English" men content genereras på svenska.
**Klart när:** UI-språk och content-språk speglar varandra, eller är två separata, dokumenterade inställningar.

### P0.5 – Byt GitHub PAT mot OAuth-app
**Klart när:** Settings → Publishing → "Connect GitHub" är OAuth, ingen tokenruta.

### P0.6 – Juridik synlig i UI
**Vad:** ToS, Privacy Policy, DPA-mall, cookie-consent (GDPR).
**Klart när:** Footer länkar till samtliga; cookie-banner aktiv.

### P0.7 – Agent-säkerhetsnät innan auto-publish
**Vad:** Default = approval required innan agent skickar något publikt (Content/Social/Ads). Opt-in till auto-publish.
**Klart när:** Approval-flöde finns för minst Content och Social.

### P0.8 – Reviews-agenten är luft
**Vad:** Plocka bort den från marknadsföringen tills den finns, eller specificera (Trustpilot/G2/Google Reviews-monitorering).
**Klart när:** Reviews-agent har en konkret implementation eller är borttagen från Plan-sidan.

---

## Prioritet 1 – Grafisk höjning

### P1.1 – Riktig logotyp och varumärkesnärvaro
Logo-svg, favicon (16/32/180/512), open-graph-bild, e-post-mall.

### P1.2 – Designspråk: fyra primära komponenter
StatCard, EmptyState, ConnectionRow, AgentRow. Alla 9 vyer använder dem.

### P1.3 – Ge varje "0" ett innehåll
"Ingen data ännu" + förklarande mening + nästa-steg-CTA, eller demo-data tills första run.

### P1.4 – Konsekvent kortdesign på Dashboard
Ett kort per agent (GEO, SEO, Content, Social, Ads, Reviews, Analytics). Varje kort har KPI + delta + "Öppna".

### P1.5 – Sidnavigering: ikoner + struktur
Gruppera: Översikt / Agenter / Konto.

### P1.6 – Skeleton loaders
Alla huvudvyer har skeleton vid första render.

### P1.7 – Brand voice / tone training
Ladda upp 3–5 exempeltexter eller URL:er, agenten matchar tonen.

### P1.8 – Agent transparency / "Why did SAMA do this?"
För varje agent-output: kort prompt-kontext + källor + confidence.

---

## Prioritet 2 – Funktionella luckor per flik

### P2.1 – Dashboard: aktivitetsflöde
"SEO Agent fann 3 nya keywords", "Content Agent publicerade utkast X" – senaste 30 dagar, klickbart.

### P2.2 – SEO: data utan GSC
Manuella keywords ger position-data inom 24h via SerpAPI.

### P2.3 – Content: ersätt GitHub-kravet med direkt publicering
WordPress.com + Webflow föreslås. GitHub kvar som "advanced".

### P2.4 – Social: koppling på Social-sidan
X, LinkedIn, Reddit OAuth i Settings; banner på /c/social när inget kopplat.

### P2.5 – Ads: faktiska kampanjresultat
OAuth Meta Ads + Google Ads, lista kampanjer med spend/CTR/CPL/CAC, AI-rekommendationer.

### P2.6 – Analytics: faktiska grafer
Tidsserie, källfördelning, funnel, ROAS per agent.

### P2.7 – GEO Monitor: queries krävs
Auto-generera 5 sample-queries baserat på brand-info; blockera tom check.

### P2.8 – Plan: förbrukning + uppgradera
Förbrukningsmätare per kvot; Stripe checkout för uppgradering; faktura-historik.

### P2.9 – Kombinerad SEO + GEO-analys (ny kärnfunktion)
**Vad:** Ny vy `/c/analysis` som kör samkörd analys över traditionell SEO (Google) och GEO (ChatGPT, Claude, Perplexity, Gemini, Google AIO, Copilot).

**Tre delflöden:**
1. **Setup:** Hämta brand/domän/USP/competitors. Auto-generera 10–25 kandidat-queries via LLM. Användaren godkänner/redigerar. Välj omfattning.
2. **Körning:** Per query: SerpAPI (top 10 + featured snippet + AIO) + LLM-frågor. Mät: SEO-rank, SEO-share, AI mention rate, AI rank, AI source citations, sentiment.
3. **Output – tre vyer:**
   - **Översikt:** sammanlagt mention rate, SEO-coverage, top 3 möjligheter
   - **Per query:** heatmap-matris (queries × kanaler)
   - **Gap-analys:** kategorier
     - "SEO-vinnare, GEO-förlorare" – optimera för citation
     - "GEO-vinnare, SEO-förlorare" – pillar-content, backlinks
     - "Båda förlorare" – ny content-vinkel
     - "Båda vinnare" – behåll
     - "Konkurrent dominerar" – konkurrent x på båda kanaler

   Varje gap har CTA: "Generera content-utkast", "Lägg till som SEO-keyword", "Övervaka månadsvis i GEO Monitor".

**Vad det löser:**
- **Differentiering** mot Semrush/Ahrefs/AthenaHQ/Profound
- **Kopplar SEO-agenten och GEO Monitor**
- **Driver Content-agenten** – varje gap blir en automatisk content-brief
- **Kostnadskontroll** – 10–25 queries/analys = förutsägbar kostnad

**Klart när:**
- /c/analysis finns med Setup → Körning → Output
- Analyser sparas och kan jämföras över tid
- Varje gap-rad har CTA som faktiskt skapar Content/SEO-keyword/GEO-query
- PDF-export
- Schemalagd version (vecko-/månadssnapshot)

**Kommersiell positionering:**
- Starter: 1 analys/mån, 10 queries
- Growth: 4 analyser/mån, 25 queries, alla 6 AI-plattformar
- Enterprise: obegränsat, custom queries, API-access

### P2.10 – Billing-djup
Årlig vs månadsvis (20% rabatt), VAT (Stripe Tax), self-serve cancellation, proration, dunning, faktura-PDF.

### P2.11 – API + webhooks
REST-endpoint + webhook när agent-runs slutar. Sticky för Enterprise.

### P2.12 – Reviews-agent (om kvar)
G2/Trustpilot/Google Reviews monitorering, sentiment, alert vid negativ review, AI-svarsutkast.

### P2.13 – Free trial-mekanik
Längd, kreditkort krävs?, dag 15-flöde.

---

## Prioritet 3 – Onboarding och konvertering

### P3.1 – Guided onboarding-wizard
Välkomna → Brand-info → Konkurrenter → Google → Social → Generera första content + GEO-queries → Dashboard med riktig data. Mål: <5 min till första data.

### P3.2 – Pre-trial-bedömning
Bransch/ICP/månadstrafik styr planrekommendation.

### P3.3 – In-app help (⌘K)
Sökbar docs, "Boka demo", support, snabblänkar.

### P3.4 – E-post / in-app notifikationer
Onboarding klar, första content-utkast, agent failed >3, GEO-rank tappar, veckorapport.

### P3.5 – Demo-sandbox utan signup
"Try without signup" med fake-data för en fiktiv B2B SaaS.

### P3.6 – CSM-spår för Growth+
Manuell onboarding-call på Growth ($399) och uppåt.

---

## Prioritet 4 – Förtroende, mätbarhet, försäljningsstöd

### P4.1 – Status-page och uptime
status.successifier.com, linkad från footer.

### P4.2 – Audit log per workspace
"Vem ändrade vad och när".

### P4.3 – Team-funktion (multi-user)
Bjuda in, roller (owner/admin/editor/viewer).

### P4.4 – ROI-report (säljmaterial)
Exportbar PDF: timmar sparade, CPL vs benchmark, trafiktillväxt.

### P4.5 – Felmonitorering synligt för kund
Varje failed run kopplar till CTA i UI:t som löser orsaken.

### P4.6 – SSO (SAML/OIDC) + SCIM
Enterprise-blocker.

### P4.7 – SOC2 Type I roadmap
Vanta/Drata, "in progress" på trust-page.

### P4.8 – Data export + radering
GDPR Art. 17 + 20 self-serve.

### P4.9 – Backup/DR-kommunikation
RPO/RTO på trust-page för säljsamtal.

---

## Föreslagen ordning (4–6 sprintar)

| Sprint | Innehåll |
|---|---|
| **Sprint 1** | P0.1 (LLM-nycklar bort), P0.2 (Stop Claude bort), P0.3 (Failed runs CTA), P0.4 (språk), P0.6 (juridik), P1.1 (logo/favicon) |
| **Sprint 2** | **P2.9 SEO+GEO-analys MVP** (hero-feature), P1.3 (empty states), P0.5 (GitHub OAuth), P0.7 (approval-flöde) |
| **Sprint 3** | P1.2 (komponentbibliotek), P1.4 (Dashboard), P3.1 (onboarding wizard), P2.7 (GEO queries auto-generering) |
| **Sprint 4** | P2.4 (Social-integrationer), P2.8 (Plan-uppgradering), P2.6 (Analytics-grafer), **P2.9 fas 2: schemaläggning + PDF** |
| **Sprint 5** | P2.5 (Ads-integrationer), P2.3 (CMS-publicering), P3.3 (in-app help), P3.4 (notifications), P2.10 (billing-djup) |
| **Sprint 6** | P4.5 (felmonitorering), P1.6 (skeleton), P4.3 (team), P4.1 (status-page), P4.2 (audit log), P4.4 (ROI-report), P3.2 (signup-bedömning), P4.8 (data export) |

Senare: P1.7 (brand voice), P1.8 (agent transparency), P2.11 (API), P2.12 (Reviews), P4.6 (SSO), P4.7 (SOC2).

---

## Vad som **inte** behöver göras nu

- Mobil-app
- Native AI-chat-gränssnitt i produkten
- White-label / agency-mode
- Custom dashboards/widgets

---

## KPI:er per sprint

- **Time-to-first-value** (signup → första riktiga data) – mål: <10 min
- **Activation rate** (% trial som ansluter ≥1 integration) – mål: 60%
- **Trial-to-paid** – baseline först, sen optimera
- **NRR (Net Revenue Retention)** – långsiktigt SaaS-värde
- **Antal aktiva agenter per workspace** – proxy för djup
- **Approval-rate på agent-utkast** – <60% = brand voice/prompts fel
- **Antal "Failed"-runs synliga för kund** – mål: 0 i första vyn
