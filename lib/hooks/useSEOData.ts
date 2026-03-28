import { useEffect, useState } from 'react';

interface SEOStats {
  avgPosition: number;
  totalClicks: number;
  totalImpressions: number;
  avgCTR: number;
}

interface KeywordData {
  keyword: string;
  position: number;
  clicks: number;
  impressions: number;
  ctr: number;
  intent?: string;
  priority?: string;
}

export function useSEOData() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [stats, setStats] = useState<SEOStats | null>(null);
  const [keywords, setKeywords] = useState<KeywordData[]>([]);

  useEffect(() => {
    let isMounted = true;

    async function fetchData() {
      try {
        const SAMA_API = process.env.NEXT_PUBLIC_SAMA_API_URL || 'https://web-production-5324a.up.railway.app';
        const response = await fetch(`${SAMA_API}/api/seo/keywords`, {
          signal: AbortSignal.timeout(5000)
        });

        if (!response.ok) {
          throw new Error(`API returned ${response.status}`);
        }

        if (!isMounted) return;

        const data = await response.json();

        if (data.keywords && data.keywords.length > 0) {
          const totalClicks = data.keywords.reduce((sum: number, kw: any) => sum + (kw.current_clicks || 0), 0);
          const totalImpressions = data.keywords.reduce((sum: number, kw: any) => sum + (kw.current_impressions || 0), 0);
          const withPosition = data.keywords.filter((kw: any) => kw.current_position && kw.current_position > 0);
          const avgPosition = withPosition.length > 0
            ? withPosition.reduce((sum: number, kw: any) => sum + kw.current_position, 0) / withPosition.length
            : 0;
          const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

          setStats({
            avgPosition: parseFloat(avgPosition.toFixed(1)),
            totalClicks,
            totalImpressions,
            avgCTR: parseFloat(avgCTR.toFixed(1)),
          });

          setKeywords(data.keywords.slice(0, 10).map((kw: any) => ({
            keyword: kw.keyword,
            position: kw.current_position || 0,
            clicks: kw.current_clicks || 0,
            impressions: kw.current_impressions || 0,
            ctr: kw.current_impressions > 0 ? ((kw.current_clicks / kw.current_impressions) * 100) : 0,
            intent: kw.intent || '',
            priority: kw.priority || '',
          })));
          setLastUpdated(new Date());
          setError(null);
        } else {
          setStats(null);
          setKeywords([]);
          setLastUpdated(new Date());
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Kunde inte ladda SEO-data');
          setStats(null);
          setKeywords([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      isMounted = false;
    };
  }, []);

  return { loading, error, lastUpdated, stats, keywords };
}
