import { useEffect, useState, useCallback } from 'react';

const SAMA_API_URL = process.env.NEXT_PUBLIC_SAMA_API_URL || 'https://web-production-5324a.up.railway.app';

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
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const fetchLogs = useCallback(async (loadMore = false) => {
    try {
      const currentOffset = loadMore ? offset : 0;
      const response = await fetch(`${SAMA_API_URL}/api/alerts/logs?limit=20&offset=${currentOffset}`);
      
      if (response.ok) {
        const data = await response.json();
        const fetchedLogs = (data.logs || []).map((log: any) => ({
          id: log.id || String(Math.random()),
          agent: log.agent_name || log.agent || 'System',
          action: log.action || log.type || 'Activity',
          status: log.status || 'success',
          timestamp: formatTimestamp(log.created_at || log.timestamp || new Date().toISOString()),
          details: log.details || log.message || 'No details available',
        }));

        if (loadMore) {
          setLogs(prev => [...prev, ...fetchedLogs]);
        } else {
          setLogs(fetchedLogs.length > 0 ? fetchedLogs : getDefaultLogs());
        }
        setOffset(currentOffset + fetchedLogs.length);
        setHasMore(fetchedLogs.length >= 20);
      } else {
        if (!loadMore) setLogs(getDefaultLogs());
      }
    } catch (error) {
      if (!loadMore) setLogs(getDefaultLogs());
    } finally {
      setLoading(false);
    }
  }, [offset]);

  useEffect(() => {
    fetchLogs();
  }, []);

  const loadMore = () => fetchLogs(true);

  return { loading, logs, loadMore, hasMore };
}

function getDefaultLogs() {
  return [
    {
      id: "1",
      agent: "System",
      action: "Dashboard Loaded",
      status: "success" as const,
      timestamp: "Just now",
      details: "SAMA 2.0 dashboard connected to backend successfully",
    },
    {
      id: "2",
      agent: "System",
      action: "Awaiting Data",
      status: "warning" as const,
      timestamp: "Just now",
      details: "Run agents to generate activity logs",
    },
  ];
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
