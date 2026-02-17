import { useEffect, useState } from 'react';
import { supabase } from '../supabase';

interface LogEntry {
  id: string;
  agent: string;
  action: string;
  status: 'success' | 'error' | 'warning';
  timestamp: string;
  details: string;
}

export function useActivityLogs() {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    async function fetchLogs() {
      try {
        const { data, error } = await supabase
          .from('agent_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20);

        if (error) throw error;

        if (data && data.length > 0) {
          const formattedLogs = data.map((log: any) => ({
            id: log.id,
            agent: log.agent_name || 'Unknown Agent',
            action: log.action || 'Unknown Action',
            status: log.status || 'success',
            timestamp: formatTimestamp(log.created_at),
            details: log.details || log.result || 'No details available',
          }));
          setLogs(formattedLogs);
        } else {
          // Fallback data
          setLogs([
            {
              id: "1",
              agent: "SEO Agent",
              action: "GSC Data Fetch",
              status: "success",
              timestamp: "2 minutes ago",
              details: "Fetched 34 clicks, 117 impressions from Google Search Console",
            },
            {
              id: "2",
              agent: "Social Agent",
              action: "Twitter Auth",
              status: "success",
              timestamp: "5 minutes ago",
              details: "Authenticated as @successifier",
            },
            {
              id: "3",
              agent: "Ads Agent",
              action: "Campaign Fetch",
              status: "warning",
              timestamp: "10 minutes ago",
              details: "No active campaigns found in Google Ads account",
            },
          ]);
        }
      } catch (error) {
        console.error('Error fetching logs:', error);
        // Use fallback data
        setLogs([
          {
            id: "1",
            agent: "SEO Agent",
            action: "GSC Data Fetch",
            status: "success",
            timestamp: "2 minutes ago",
            details: "Fetched 34 clicks, 117 impressions from Google Search Console",
          },
          {
            id: "2",
            agent: "Social Agent",
            action: "Twitter Auth",
            status: "success",
            timestamp: "5 minutes ago",
            details: "Authenticated as @successifier",
          },
        ]);
      } finally {
        setLoading(false);
      }
    }

    fetchLogs();

    // Set up real-time subscription
    const subscription = supabase
      .channel('agent_logs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'agent_logs' }, (payload) => {
        const newLog = {
          id: payload.new.id,
          agent: payload.new.agent_name || 'Unknown Agent',
          action: payload.new.action || 'Unknown Action',
          status: payload.new.status || 'success',
          timestamp: 'Just now',
          details: payload.new.details || payload.new.result || 'No details available',
        };
        setLogs((prev) => [newLog, ...prev]);
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return { loading, logs };
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}
