export type Lang = "sv" | "en";

export const homeContent = {
  meta: {
    sv: {
      title: "SAMA — AI-driven marknadsplattform: GEO, SEO, content & tech på autopilot",
      description:
        "SAMA driver SEO, GEO, content, sajt-fixar och rapporter på autopilot. Bevakar er synlighet i ChatGPT, Perplexity, Claude, Google AIO, Gemini och Copilot.",
    },
    en: {
      title: "SAMA — AI marketing platform: GEO, SEO, content & tech on autopilot",
      description:
        "SAMA runs SEO, GEO, content, site fixes and reporting on autopilot. Tracks your visibility in ChatGPT, Perplexity, Claude, Google AIO, Gemini and Copilot.",
    },
  },
  hero: {
    sv: {
      eyebrow: "Marknadsarbete på autopilot. AI-native.",
      headline: "SEO, GEO, content, sajt-fixar och rapporter — på autopilot.",
      subhead:
        "SAMA bevakar er synlighet i Google och alla sex stora AI-motorer, genererar citerings-färdiga artiklar varje vecka, och föreslår tekniska sajt-förbättringar som Pull Requests. Allt i ett verktyg.",
      cta1: "Kör gratis AI-audit",
      cta2: "Starta trial",
      trust: "Gratis audit · Inget kort · Resultat på 30 sekunder",
    },
    en: {
      eyebrow: "Marketing on autopilot. AI-native.",
      headline: "SEO, GEO, content, site fixes and reporting — on autopilot.",
      subhead:
        "SAMA tracks your visibility in Google and all six major AI engines, drafts citation-ready articles weekly, and proposes technical site improvements as Pull Requests. All in one tool.",
      cta1: "Run free AI audit",
      cta2: "Start trial",
      trust: "Free audit · No card · Results in 30 seconds",
    },
  },
  trustStrip: {
    sv: {
      label: "Bevakar er synlighet i:",
      engines: [
        "ChatGPT",
        "Perplexity",
        "Claude",
        "Google AI Overviews",
        "Gemini",
        "Microsoft Copilot",
      ],
      syncLabel: "Synkar med:",
      syncs: ["Google Search Console", "GA4", "Google Ads"],
    },
    en: {
      label: "Tracks your visibility across:",
      engines: [
        "ChatGPT",
        "Perplexity",
        "Claude",
        "Google AI Overviews",
        "Gemini",
        "Microsoft Copilot",
      ],
      syncLabel: "Syncs with:",
      syncs: ["Google Search Console", "GA4", "Google Ads"],
    },
  },
  problem: {
    sv: {
      heading: "Fem verktyg, ett team, tio tabbar öppna. Det funkar inte 2026.",
      body1:
        "De flesta marknadsteam kedjar ihop ett SEO-verktyg, ett analytics-verktyg, ett content-verktyg, en AI-monitoring-tjänst och en CMS — och spenderar halva veckan på att flytta data mellan dem. SAMA samlar allt under ett tak och kör det löpande på autopilot, så teamet kan göra strategi i stället för limbo.",
      body2:
        "Och AI-eran har lagt till ett extra ben i jobbet: era kunder frågar ChatGPT och Perplexity innan de googlar. Är ni inte med i AI-svaret förlorar ni dem innan ni vet om det. SAMA bevakar och stänger det gapet veckovis.",
    },
    en: {
      heading: "Five tools, one team, ten browser tabs. That broke in 2026.",
      body1:
        "Most marketing teams chain together an SEO tool, an analytics tool, a content tool, an AI-monitoring service and a CMS — and spend half the week moving data between them. SAMA brings it all under one roof and runs it on autopilot, so the team gets to do strategy instead of plumbing.",
      body2:
        "And the AI era added another leg to the job: your customers ask ChatGPT and Perplexity before they Google. If you are not in the AI answer, you lose them before you ever knew. SAMA monitors and closes that gap every week.",
    },
  },
  pillars: {
    sv: {
      eyebrow: "Fem agenter. Ett team. På autopilot.",
      heading: "Allt marknadsarbete i ett verktyg",
      items: [
        {
          title: "AI-synlighet (GEO)",
          desc: "Varje måndag kollar SAMA hur ni nämns i ChatGPT, Perplexity, Claude, Google AIO, Gemini och Microsoft Copilot — och jämför med era konkurrenter.",
          schedule: "Måndag 07:30",
          href: "/platform/ai-visibility",
        },
        {
          title: "SEO och Google",
          desc: "Nattligt synk med Google Search Console. Sökord, klick och positioner, varje dygn.",
          schedule: "Daglig 02:00",
          href: "/platform/seo",
        },
        {
          title: "Trafik och analytics",
          desc: "GA4-data, kanalmix och konverteringar — rapporterade där ni redan jobbar.",
          schedule: "Daglig 04:00",
          href: "/platform/seo",
        },
        {
          title: "Sajtanalys (Tech)",
          desc: "Crawl av 200 sidor varje söndag. Tekniska och innehållsmässiga brister blir konkreta Pull Requests mot ert repo.",
          schedule: "Söndagar",
          href: "/platform/tech",
        },
        {
          title: "Content",
          desc: "Onsdag morgon föreslår agenten nya artiklar och AI Gap-vinklar. Ni godkänner i kö, SAMA publicerar via GitHub PR, CMS eller mail.",
          schedule: "Onsdag 06:00",
          href: "/platform/content",
        },
      ],
      cta: "Se hela autopilot-flödet",
    },
    en: {
      eyebrow: "Five agents. One team. On autopilot.",
      heading: "The whole marketing workflow in one tool",
      items: [
        {
          title: "AI Visibility (GEO)",
          desc: "Every Monday SAMA checks how you appear in ChatGPT, Perplexity, Claude, Google AIO, Gemini and Microsoft Copilot — versus your competitors.",
          schedule: "Monday 07:30",
          href: "/platform/ai-visibility",
        },
        {
          title: "SEO and Google",
          desc: "Nightly sync with Google Search Console. Keywords, clicks and positions, every 24 hours.",
          schedule: "Daily 02:00",
          href: "/platform/seo",
        },
        {
          title: "Traffic and analytics",
          desc: "GA4 data, channel mix and conversions — reported where your team already lives.",
          schedule: "Daily 04:00",
          href: "/platform/seo",
        },
        {
          title: "Site analysis (Tech)",
          desc: "200-page crawl every Sunday. Technical and content issues turn into concrete Pull Requests against your repo.",
          schedule: "Sundays",
          href: "/platform/tech",
        },
        {
          title: "Content",
          desc: "Wednesday morning the agent proposes new articles and AI Gap angles. You approve in a queue, SAMA publishes via GitHub PR, CMS or email.",
          schedule: "Wednesday 06:00",
          href: "/platform/content",
        },
      ],
      cta: "See the autopilot flow",
    },
  },
  aiGap: {
    sv: {
      eyebrow: "Signaturformat",
      heading: "AI Gap-artiklar — vinn frågorna AI inte har svar på än",
      body: "AI Gap är vårt eget content-format. SAMA hittar frågor som er målgrupp ställer i AI-motorer men där svaret är tunt, opersonligt eller motstridigt. Sen skriver vi artiklarna som fyller det gapet — och era konkurrenter blir omkörda.",
      cta: "Lär dig mer om AI Gap",
    },
    en: {
      eyebrow: "Signature format",
      heading: "AI Gap articles — win the questions AI does not have a clear answer to yet",
      body: "AI Gap is our signature content format. SAMA finds questions your audience asks in AI engines where the current answer is thin, generic, or contradictory. Then we draft the articles that fill that gap — and your competitors get overtaken.",
      cta: "Learn more about AI Gap",
    },
  },
  integrations: {
    sv: {
      heading: "Publicerar dit ni redan jobbar",
      body: "Native integrationer: WordPress, Shopify, Webflow, Framer, Ghost, Wix, GoHighLevel, Duda, BigCommerce, Notion. Plus webhook och GitHub Pull Request. Data hämtas via Google Search Console, GA4 och Google Ads.",
    },
    en: {
      heading: "Publishes where you already work",
      body: "Native integrations: WordPress, Shopify, Webflow, Framer, Ghost, Wix, GoHighLevel, Duda, BigCommerce, Notion. Plus webhook and GitHub Pull Request. Data pulled from Google Search Console, GA4 and Google Ads.",
    },
  },
  socialProof: {
    sv: {
      eyebrow: "Resultat",
      heading: "Vad våra kunder mätt på 90 dagar",
      stats: [
        { value: "+312%", label: "AI-omnämnanden i Perplexity för en B2B SaaS" },
        { value: "14", label: "Nya hörnstensartiklar publicerade per månad utan att utöka teamet" },
        { value: "22", label: "Nya sökord i topp-3 på Google inom 90 dagar" },
      ],
      quote:
        "SAMA tog oss från noll citat i Perplexity till topp tre på sex veckor. Det är som att ha hyrt in ett helt content-team — fast snabbare.",
    },
    en: {
      eyebrow: "Results",
      heading: "What our customers measured in 90 days",
      stats: [
        { value: "+312%", label: "More Perplexity mentions for a B2B SaaS in fintech" },
        { value: "14", label: "New pillar articles shipped per month without growing the team" },
        { value: "22", label: "New keywords in top-3 on Google inside 90 days" },
      ],
      quote:
        "SAMA took us from zero Perplexity citations to top three in six weeks. It is like hiring a full content team — only faster.",
    },
  },
  auditCta: {
    sv: {
      heading: "Se er synlighet i Google och AI — på 30 sekunder",
      body: "Gratis, inget kort. Vi crawlar er startsida och ger en åtgärdslista ni kan börja jobba med samma vecka.",
      cta: "Kör gratis audit",
    },
    en: {
      heading: "See your visibility in Google and AI — in 30 seconds",
      body: "Free, no card. We crawl your homepage and hand back an action list you can start that week.",
      cta: "Run free audit",
    },
  },
  pricing: {
    sv: {
      eyebrow: "Priser",
      heading: "Börja gratis. Skala när SAMA börjar leverera.",
      subhead:
        "Alla planer inkluderar audit, content-agent, tech-PR:s och publicering. LLM-kostnaden ingår — ni betalar inte API-avgifter separat.",
      cta: "Se alla planer",
      tiers: [
        {
          name: "Starter",
          price: "1 489 kr",
          cadence: "/mån",
          desc: "För grundare och småteam som börjar med AI-sökning.",
          features: ["1 sajt", "Veckovis AI-synlighet", "10 content-utkast/mån"],
        },
        {
          name: "Growth",
          price: "3 989 kr",
          cadence: "/mån",
          desc: "För team som vill publicera content och äga rankingarna.",
          features: ["3 sajter", "Daglig monitoring", "Obegränsat utkast", "CMS-integrationer"],
          highlight: true,
        },
        {
          name: "Enterprise",
          price: "Custom",
          cadence: "",
          desc: "För multi-varumärkes-team och byråer med skalningsbehov.",
          features: ["Obegränsat sajter", "Multi-tenant admin", "Dedikerad success"],
        },
      ],
    },
    en: {
      eyebrow: "Pricing",
      heading: "Start free. Scale when SAMA starts delivering.",
      subhead:
        "All plans include the audit, content agent, tech PRs and publishing. LLM costs are included — you do not pay API fees separately.",
      cta: "See all plans",
      tiers: [
        {
          name: "Starter",
          price: "$149",
          cadence: "/mo",
          desc: "For founders and small teams getting into AI search.",
          features: ["1 site", "Weekly AI visibility scan", "10 content drafts/mo"],
        },
        {
          name: "Growth",
          price: "$399",
          cadence: "/mo",
          desc: "For teams that need to ship content and own the rankings.",
          features: ["3 sites", "Daily monitoring", "Unlimited drafts", "CMS integrations"],
          highlight: true,
        },
        {
          name: "Enterprise",
          price: "Custom",
          cadence: "",
          desc: "For multi-brand teams and agencies with scale needs.",
          features: ["Unlimited sites", "Multi-tenant admin", "Dedicated success"],
        },
      ],
    },
  },
  bottomCta: {
    sv: {
      heading: "Nästa gång någon frågar AI — var svaret.",
      body: "Börja med den gratis auditen. Se var ni står, se vad ni ska fixa, och publicera er första AI-citerade artikel den här veckan.",
      cta1: "Kör gratis audit",
      cta2: "Starta 14-dagars trial",
    },
    en: {
      heading: "The next time someone asks AI, be the answer.",
      body: "Start with the free audit. See where you stand, see what to fix, and ship your first AI-cited article this week.",
      cta1: "Run free audit",
      cta2: "Start 14-day trial",
    },
  },
};
