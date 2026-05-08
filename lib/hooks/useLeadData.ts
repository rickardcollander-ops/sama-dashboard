import { useEffect, useState, useCallback } from 'react';
import { SAMA_API_URL } from '@/lib/api';

interface Lead {
  id: string;
  email: string;
  name: string;
  company: string;
  phone: string;
  status: string;
  score: number;
  source_url: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  created_at: string;
}

interface LeadStats {
  total: number;
  new: number;
  contacted: number;
  qualified: number;
  meeting_booked: number;
  converted: number;
  by_source: Record<string, number>;
  by_status: Record<string, number>;
}

export function useLeadData() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<LeadStats | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [leadsRes, statsRes] = await Promise.all([
        fetch(`${SAMA_API_URL}/api/leads?limit=50`),
        fetch(`${SAMA_API_URL}/api/leads/stats`),
      ]);

      if (!leadsRes.ok || !statsRes.ok) {
        throw new Error(`API error: leads=${leadsRes.status}, stats=${statsRes.status}`);
      }

      const leadsData = await leadsRes.json();
      const statsData = await statsRes.json();

      setLeads(leadsData.leads || []);
      setStats(statsData.stats || null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load lead data');
      setLeads([]);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { loading, error, leads, stats, refresh: fetchData };
}
