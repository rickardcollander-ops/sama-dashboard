export type Language = "sv" | "no" | "da" | "en";

export const LANGUAGES: { code: Language; flag: string; label: string }[] = [
  { code: "sv", flag: "🇸🇪", label: "SV" },
  { code: "no", flag: "🇳🇴", label: "NO" },
  { code: "da", flag: "🇩🇰", label: "DA" },
  { code: "en", flag: "🇬🇧", label: "EN" },
];

export const translations = {
  sv: {
    nav: {
      home: "Hem",
      insights: "Insikter",
      content: "Content",
      tech: "Tech",
      settings: "Inställningar",
      admin: "Admin",
    },
    subNav: {
      overview: "Översikt",
      google: "Google",
      aiAssistants: "AI-assistenter",
      traffic: "Trafik",
      calendar: "Kalender",
      account: "Konto",
      sites: "Sidor",
      integrations: "Integrationer",
      billing: "Plan & fakturering",
    },
    siteSwitcher: {
      selectSite: "Välj sida",
      manageSites: "Hantera sidor →",
      unnamed: "Namnlös sida",
    },
    common: {
      logout: "Logga ut",
      openMenu: "Öppna meny",
      closeMenu: "Stäng meny",
      language: "Språk",
    },
  },
  no: {
    nav: {
      home: "Hjem",
      insights: "Innsikter",
      content: "Innhold",
      tech: "Tech",
      settings: "Innstillinger",
      admin: "Admin",
    },
    subNav: {
      overview: "Oversikt",
      google: "Google",
      aiAssistants: "AI-assistenter",
      traffic: "Trafikk",
      calendar: "Kalender",
      account: "Konto",
      sites: "Sider",
      integrations: "Integrasjoner",
      billing: "Plan & fakturering",
    },
    siteSwitcher: {
      selectSite: "Velg side",
      manageSites: "Administrer sider →",
      unnamed: "Navnløs side",
    },
    common: {
      logout: "Logg ut",
      openMenu: "Åpne meny",
      closeMenu: "Lukk meny",
      language: "Språk",
    },
  },
  da: {
    nav: {
      home: "Hjem",
      insights: "Indsigter",
      content: "Indhold",
      tech: "Tech",
      settings: "Indstillinger",
      admin: "Admin",
    },
    subNav: {
      overview: "Oversigt",
      google: "Google",
      aiAssistants: "AI-assistenter",
      traffic: "Trafik",
      calendar: "Kalender",
      account: "Konto",
      sites: "Sider",
      integrations: "Integrationer",
      billing: "Plan & fakturering",
    },
    siteSwitcher: {
      selectSite: "Vælg side",
      manageSites: "Administrer sider →",
      unnamed: "Unavngivet side",
    },
    common: {
      logout: "Log ud",
      openMenu: "Åbn menu",
      closeMenu: "Luk menu",
      language: "Sprog",
    },
  },
  en: {
    nav: {
      home: "Home",
      insights: "Insights",
      content: "Content",
      tech: "Tech",
      settings: "Settings",
      admin: "Admin",
    },
    subNav: {
      overview: "Overview",
      google: "Google",
      aiAssistants: "AI Assistants",
      traffic: "Traffic",
      calendar: "Calendar",
      account: "Account",
      sites: "Sites",
      integrations: "Integrations",
      billing: "Plan & Billing",
    },
    siteSwitcher: {
      selectSite: "Select site",
      manageSites: "Manage sites →",
      unnamed: "Unnamed site",
    },
    common: {
      logout: "Log out",
      openMenu: "Open menu",
      closeMenu: "Close menu",
      language: "Language",
    },
  },
};

export type Translations = typeof translations.sv;
