# Paperclip Integration — Setup Guide

## Översikt

SAMA Dashboard hanterar marketing-agenter. **Paperclip** orkestrerar hela bolaget — CEO, CTO, CFO, COO, CSO med underagenter, budgetkontroll, mål-hierarki och governance.

- **SAMA** = "Vad marketing-agenterna gör" (SEO, content, ads, social, reviews)
- **Paperclip** = "Hur hela bolaget organiseras" (hierarki, budget, mål, delegering)

## Arkitektur

```
┌─────────────────────────────────────────────┐
│  Paperclip (Railway)                        │
│  https://paperclip-production-193c.up.      │
│  railway.app                                │
│                                             │
│  CEO ─┬─ CMO → SAMA marketing-agenter      │
│       ├─ CTO → Dev, DevOps                 │
│       ├─ CFO → Budget-agent                │
│       ├─ COO → Support, Onboarding         │
│       └─ CSO → Lead-gen, Pipeline          │
│                                             │
│  Alla agenter = Claude Code-sessioner       │
│  via claude_local adapter                   │
└─────────────────────────────────────────────┘
         │
         │ CMO använder SAMA API
         ▼
┌─────────────────────────────────────────────┐
│  SAMA Dashboard (Vercel)                    │
│  Marketing-agenter: NOVA, MUSE, APEX,      │
│  ECHO, SENTINEL, ORACLE, FORGE             │
└─────────────────────────────────────────────┘
```

## Snabbstart

### 1. Paperclip är deployad

URL: `https://paperclip-production-193c.up.railway.app`

Railway-templaten inkluderar:
- Paperclip-server (port 3100)
- Managed Postgres (automatiskt kopplad)
- Persistent volym på `/paperclip`
- Publik URL

### 2. Registrera admin

Gå till `https://paperclip-production-193c.up.railway.app/setup`

1. Klicka **"Register as Admin"**
2. Skapa admin-konto
3. Klicka **"Launch Paperclip"**

### 3. Importera company-template

Kör i din terminal:

```bash
# Klona company-templates
git clone https://github.com/paperclipai/companies.git /tmp/paperclip-companies

# Importera AgentSys Engineering (5 agenter, 14 skills)
npx companies.sh add /tmp/paperclip-companies/agentsys-engineering \
  --provider paperclip \
  --yes \
  --api-base https://paperclip-production-193c.up.railway.app \
  --include company,agents,skills
```

Detta skapar:

| Agent | Roll | Modell |
|-------|------|--------|
| CEO | Chief Executive Officer | claude-opus-4-6 |
| CTO | Chief Technology Officer | claude-opus-4-6 |
| Staff Engineer | Staff Software Engineer | claude-opus-4-6 |
| QA & Release Lead | QA & Release Lead | claude-sonnet-4-6 |
| Research & Perf Analyst | Research & Performance Analyst | claude-opus-4-6 |

### 4. Konfigurera (valfritt)

Via Paperclip UI eller API:

```bash
API_BASE="https://paperclip-production-193c.up.railway.app"

# Byt företagsnamn
curl -X PATCH "$API_BASE/api/companies/{companyId}" \
  -H "Content-Type: application/json" \
  -d '{"name": "Successifier"}'

# Sätt månadsbudget ($2000)
curl -X PATCH "$API_BASE/api/companies/{companyId}" \
  -H "Content-Type: application/json" \
  -d '{"monthlyBudgetCents": 200000}'

# Skapa företagsmål
curl -X POST "$API_BASE/api/companies/{companyId}/goals" \
  -H "Content-Type: application/json" \
  -d '{"title": "Öka MRR med 20% Q2 2026", "level": "company", "status": "active"}'
```

### 5. Lägg till fler agenter (valfritt)

Utöka med CMO, CFO, COO, CSO via API:

```bash
# Exempel: Lägg till CMO under CEO
curl -X POST "$API_BASE/api/companies/{companyId}/agents" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "CMO",
    "role": "cmo",
    "title": "Chief Marketing Officer",
    "adapter": {
      "type": "claude_local",
      "config": {
        "model": "claude-sonnet-4-6"
      }
    },
    "reportsTo": "{ceoAgentId}",
    "monthlyBudgetCents": 40000,
    "capabilities": "Koordinera marketing via SAMA API"
  }'
```

## Tillgängliga company-templates

| Template | Agenter | Skills | Beskrivning |
|----------|---------|--------|-------------|
| agentsys-engineering | 5 | 14 | Engineering pipeline — discovery → shipping |
| gstack | 5 | 27 | Garry Tans workflow — taste → rigor → ship |
| superpowers | 4 | 14 | TDD-driven dev shop |
| taches-creative | 6 | 35 | Kreativ strategi & meta-skills |
| fullstack-forge | 49 | 66 | Full-stack consultancy, 11 avdelningar |
| agency-agents | 167 | — | Komplett AI-byrå, 10 divisioner |
| trail-of-bits-security | 28 | 35 | Security audit firm |

Importera valfri:
```bash
npx companies.sh add /tmp/paperclip-companies/{template-namn} \
  --provider paperclip --yes \
  --api-base https://paperclip-production-193c.up.railway.app \
  --include company,agents,skills
```

## Resurser

- [Paperclip Docs](https://docs.paperclip.ing)
- [Paperclip GitHub](https://github.com/paperclipai/paperclip)
- [Company Templates](https://github.com/paperclipai/companies)
- [companies.sh CLI](https://companies.sh)
- [Railway Template](https://railway.com/deploy/paperclip)
