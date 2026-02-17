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
}

export function useSEOData() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<SEOStats>({
    avgPosition: 1.6,
    totalClicks: 34,
    totalImpressions: 117,
    avgCTR: 29.0,
  });
  const [keywords, setKeywords] = useState<KeywordData[]>([
    { keyword: "successifier", position: 1.0, clicks: 28, impressions: 95, ctr: 29.5 },
    { keyword: "customer success platform", position: 2.1, clicks: 4, impressions: 15, ctr: 26.7 },
    { keyword: "cs automation", position: 3.5, clicks: 2, impressions: 7, ctr: 28.6 },
  ]);

  useEffect(() => {
    let isMounted = true;
    
    async function fetchData() {
      try {
        // Fetch from SAMA backend API
        const SAMA_API = process.env.NEXT_PUBLIC_SAMA_API_URL || 'https://web-production-5324a.up.railway.app';
        const response = await fetch(`${SAMA_API}/api/seo/keywords`, {
          signal: AbortSignal.timeout(5000) // 5 second timeout
        });
        
        if (response.ok && isMounted) {
          const data = await response.json();
          
          if (data.keywords && data.keywords.length > 0) {
            // Calculate stats from keywords
            const totalClicks = data.keywords.reduce((sum: number, kw: any) => sum + (kw.current_clicks || 0), 0);
            const totalImpressions = data.keywords.reduce((sum: number, kw: any) => sum + (kw.current_impressions || 0), 0);
            const avgPosition = data.keywords.reduce((sum: number, kw: any) => sum + (kw.current_position || 0), 0) / data.keywords.length;
            const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
            
            setStats({
              avgPosition: parseFloat(avgPosition.toFixed(1)),
              totalClicks,
              totalImpressions,
              avgCTR: parseFloat(avgCTR.toFixed(1)),
            });
            
            // Map keywords to display format
            setKeywords(data.keywords.slice(0, 10).map((kw: any) => ({
              keyword: kw.keyword,
              position: kw.current_position || 0,
              clicks: kw.current_clicks || 0,
              impressions: kw.current_impressions || 0,
              ctr: kw.current_impressions > 0 ? ((kw.current_clicks / kw.current_impressions) * 100) : 0
            })));
          }
        }
      } catch (error) {
        // Silently fail - keep fallback data
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

  return { loading, stats, keywords };
}
