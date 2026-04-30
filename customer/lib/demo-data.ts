/**
 * Demo / seed data for SAMA dashboard.
 * Used when NEXT_PUBLIC_DEMO_MODE === 'true' or as fallback when API returns empty.
 */

export const IS_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

export const demoSeoKeywords = [
  { keyword: "marketing automation software", position: 3, clicks: 1240, impressions: 18500, ctr: 0.067, position_history: [{ date: "2026-03-01", position: 8 }, { date: "2026-03-08", position: 6 }, { date: "2026-03-15", position: 4 }, { date: "2026-03-22", position: 3 }] },
  { keyword: "AI marketing platform", position: 5, clicks: 890, impressions: 12300, ctr: 0.072, position_history: [{ date: "2026-03-01", position: 12 }, { date: "2026-03-08", position: 9 }, { date: "2026-03-15", position: 7 }, { date: "2026-03-22", position: 5 }] },
  { keyword: "autonomous marketing agent", position: 1, clicks: 2100, impressions: 8900, ctr: 0.236, position_history: [{ date: "2026-03-01", position: 4 }, { date: "2026-03-08", position: 2 }, { date: "2026-03-15", position: 1 }, { date: "2026-03-22", position: 1 }] },
  { keyword: "SEO content generator", position: 7, clicks: 560, impressions: 9400, ctr: 0.060, position_history: [] },
  { keyword: "social media automation", position: 12, clicks: 340, impressions: 15200, ctr: 0.022, position_history: [] },
  { keyword: "bästa marknadsföring AI", position: 2, clicks: 780, impressions: 4500, ctr: 0.173, position_history: [{ date: "2026-03-01", position: 6 }, { date: "2026-03-15", position: 3 }, { date: "2026-03-22", position: 2 }] },
  { keyword: "content marketing automation", position: 9, clicks: 420, impressions: 7800, ctr: 0.054, position_history: [] },
  { keyword: "digital marketing AI tools", position: 4, clicks: 670, impressions: 11200, ctr: 0.060, position_history: [] },
  { keyword: "lead generation platform", position: 15, clicks: 210, impressions: 6300, ctr: 0.033, position_history: [] },
  { keyword: "marketing ROI tracking", position: 6, clicks: 390, impressions: 5100, ctr: 0.076, position_history: [] },
];

export const demoContentPieces = [
  { id: "c1", title: "10 Ways AI Is Transforming B2B Marketing in 2026", type: "blog_post", status: "published", word_count: 2400, target_keyword: "AI marketing", created_at: "2026-03-25T10:00:00Z" },
  { id: "c2", title: "The Complete Guide to Marketing Automation", type: "blog_post", status: "published", word_count: 3200, target_keyword: "marketing automation", created_at: "2026-03-20T14:30:00Z" },
  { id: "c3", title: "Case Study: How SAMA Increased Leads by 340%", type: "case_study", status: "draft", word_count: 1800, target_keyword: "lead generation", created_at: "2026-03-28T09:00:00Z" },
  { id: "c4", title: "SEO vs GEO: Why AI Visibility Matters", type: "blog_post", status: "draft", word_count: 1500, target_keyword: "GEO optimization", created_at: "2026-03-30T11:00:00Z" },
  { id: "c5", title: "Landing Page: Enterprise Marketing AI", type: "landing_page", status: "published", word_count: 800, target_keyword: "enterprise marketing", created_at: "2026-03-15T16:00:00Z" },
];

export const demoSocialPosts = [
  { id: "s1", platform: "linkedin", content: "Excited to announce our latest feature: AI-powered ad copy generation. Create high-converting ads in seconds.", status: "published", published_at: "2026-03-30T09:00:00Z", likes: 142, comments: 23, impressions: 8900 },
  { id: "s2", platform: "x", content: "Marketing automation just got smarter. Our AI agents work 24/7 to optimize your campaigns.", status: "published", published_at: "2026-03-29T14:00:00Z", likes: 89, comments: 12, impressions: 5400 },
  { id: "s3", platform: "linkedin", content: "New blog post: 10 Ways AI Is Transforming B2B Marketing in 2026. Link in comments.", status: "published", published_at: "2026-03-28T10:00:00Z", likes: 234, comments: 45, impressions: 12300 },
  { id: "s4", platform: "x", content: "Did you know? Companies using AI marketing tools see 3x higher ROI on average.", status: "published", published_at: "2026-03-27T16:00:00Z", likes: 67, comments: 8, impressions: 3200 },
  { id: "s5", platform: "linkedin", content: "Join our webinar: Autonomous Marketing in Practice. Register now!", status: "scheduled", scheduled_at: "2026-04-02T10:00:00Z", likes: 0, comments: 0, impressions: 0 },
  { id: "s6", platform: "x", content: "The future of marketing is autonomous. Let AI handle the repetitive tasks while you focus on strategy.", status: "published", published_at: "2026-03-26T11:00:00Z", likes: 156, comments: 19, impressions: 7600 },
  { id: "s7", platform: "linkedin", content: "How we helped a SaaS startup go from 0 to 1000 leads in 90 days using AI-driven marketing.", status: "published", published_at: "2026-03-25T13:00:00Z", likes: 312, comments: 56, impressions: 18400 },
  { id: "s8", platform: "x", content: "SEO is evolving. Are you ready for GEO (Generative Engine Optimization)?", status: "published", published_at: "2026-03-24T15:00:00Z", likes: 98, comments: 14, impressions: 4100 },
  { id: "s9", platform: "linkedin", content: "5 mistakes B2B companies make with their content strategy (and how AI can fix them).", status: "draft", likes: 0, comments: 0, impressions: 0 },
  { id: "s10", platform: "x", content: "Proud to be featured in @TechCrunch as one of the top AI marketing platforms to watch.", status: "published", published_at: "2026-03-22T09:00:00Z", likes: 445, comments: 67, impressions: 24500 },
];

function generateDailyAnalytics(days: number) {
  const data = [];
  const now = new Date("2026-04-01");
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const base = 100 + Math.floor(Math.random() * 80);
    data.push({
      date: date.toISOString().split("T")[0],
      clicks: base + Math.floor(Math.random() * 50),
      impressions: base * 8 + Math.floor(Math.random() * 400),
    });
  }
  return data;
}

export const demoAnalytics = {
  channels: [
    { channel: "Organic Search", clicks: 4200, impressions: 89000, conversions: 120, spend: 0 },
    { channel: "Social Media", clicks: 2800, impressions: 45000, conversions: 65, spend: 1200 },
    { channel: "Paid Search", clicks: 1900, impressions: 32000, conversions: 85, spend: 3400 },
    { channel: "Content", clicks: 1500, impressions: 28000, conversions: 42, spend: 0 },
    { channel: "Email", clicks: 890, impressions: 12000, conversions: 38, spend: 200 },
  ],
  daily: generateDailyAnalytics(30),
  totals: { clicks: 11290, impressions: 206000, conversions: 350, spend: 4800 },
};

export const demoAdCreatives = [
  {
    id: "ad1",
    platform: "meta",
    format: "single_image",
    goal: "leads",
    headline: "Automatisera din marknadsföring med AI",
    body: "SAMA hanterar SEO, content och sociala medier autonomt. Boka en demo idag och se resultat inom 30 dagar.",
    cta: "Boka demo",
    status: "draft",
    created_at: "2026-03-28T10:00:00Z",
  },
  {
    id: "ad2",
    platform: "linkedin",
    format: "single_image",
    goal: "awareness",
    headline: "AI-driven marknadsföring för B2B-företag",
    body: "Sluta gissa. Låt SAMA:s AI-agenter optimera era kampanjer dygnet runt. Fler leads, högre ROI, mindre manuellt arbete.",
    cta: "Läs mer",
    status: "draft",
    created_at: "2026-03-26T14:00:00Z",
  },
  {
    id: "ad3",
    platform: "google",
    format: "single_image",
    goal: "traffic",
    headline: "AI Marketing Platform",
    body: "Autonomous marketing agents for SEO, content & social. Start free trial today.",
    cta: "Läs mer",
    status: "draft",
    created_at: "2026-03-24T09:00:00Z",
  },
];
