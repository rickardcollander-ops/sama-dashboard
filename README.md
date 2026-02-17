# SAMA 2.0 Dashboard

Modern dashboard for monitoring and controlling SAMA 2.0 autonomous marketing agents.

## Features

- **Agent Overview** - Monitor all 6 agents (SEO, Content, Ads, Social, Reviews, Analytics)
- **SEO Metrics** - Google Search Console data visualization
- **Google Ads Performance** - Campaign metrics and optimization insights
- **Twitter Activity** - Social media engagement tracking
- **Activity Logs** - Real-time agent activity feed

## Tech Stack

- Next.js 16 with App Router
- TypeScript
- Tailwind CSS
- Supabase (database)
- Lucide React (icons)

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env.local`:
```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
NEXT_PUBLIC_SAMA_API_URL=https://sama-agent-ivory.vercel.app
```

3. Run development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000)

## Pages

- `/` - Agent overview and quick stats
- `/seo` - SEO performance metrics
- `/ads` - Google Ads campaign data
- `/social` - Twitter activity
- `/logs` - Agent activity logs

## Deploy to Vercel

1. Push to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

## API Integration

Dashboard connects to SAMA 2.0 backend API:
- Base URL: `https://sama-agent-ivory.vercel.app`
- Endpoints: `/api/seo/stats`, `/api/ads/campaigns`, etc.

## License

MIT
