import { useEffect, useRef, useState, useCallback } from 'react';
import { isRealtimeEnabled } from '@/lib/supabase';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import type { SupabaseClient } from '@supabase/supabase-js';

type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

interface UseRealtimeOptions<T> {
  table: string;
  event?: RealtimeEvent;
  filter?: string;
  /** Polling interval in ms when realtime is unavailable (default: 30000). 0 to disable. */
  pollInterval?: number;
  onInsert?: (payload: T) => void;
  onUpdate?: (payload: T) => void;
  onDelete?: (payload: T) => void;
  /** Called on each poll tick (when realtime is unavailable). Use to refetch data. */
  onPoll?: () => void;
}

/**
 * Subscribe to Supabase Realtime changes on a table.
 * Falls back to polling when Realtime is unavailable or fails to connect.
 */
export function useRealtimeSubscription<T extends { id: string }>({
  table,
  event = '*',
  filter,
  pollInterval = 30_000,
  onInsert,
  onUpdate,
  onDelete,
  onPoll,
}: UseRealtimeOptions<T>) {
  const [connected, setConnected] = useState(false);
  const channelRef = useRef<ReturnType<SupabaseClient['channel']> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const onInsertRef = useRef(onInsert);
  const onUpdateRef = useRef(onUpdate);
  const onDeleteRef = useRef(onDelete);
  const onPollRef = useRef(onPoll);
  onInsertRef.current = onInsert;
  onUpdateRef.current = onUpdate;
  onDeleteRef.current = onDelete;
  onPollRef.current = onPoll;

  const startPolling = useCallback(() => {
    if (pollRef.current || !pollInterval) return;
    pollRef.current = setInterval(() => {
      onPollRef.current?.();
    }, pollInterval);
  }, [pollInterval]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    // Skip realtime entirely when disabled — fall back to polling
    if (!isRealtimeEnabled) {
      startPolling();
      return () => stopPolling();
    }

    const supabase = getSupabaseBrowser();
    const channelName = `realtime-${table}-${filter || 'all'}`;
    let retryCount = 0;
    const MAX_RETRIES = 3;

    const pgChangesConfig: any = {
      event,
      schema: 'public',
      table,
    };
    if (filter) {
      pgChangesConfig.filter = filter;
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes' as any,
        pgChangesConfig,
        (payload: any) => {
          const row = (payload.new || payload.old) as T;
          if (!row) return;

          switch (payload.eventType) {
            case 'INSERT':
              onInsertRef.current?.(row);
              break;
            case 'UPDATE':
              onUpdateRef.current?.(row);
              break;
            case 'DELETE':
              onDeleteRef.current?.(payload.old as T);
              break;
          }
        }
      )
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          setConnected(true);
          stopPolling();
          retryCount = 0;
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setConnected(false);
          retryCount++;
          if (retryCount >= MAX_RETRIES) {
            supabase.removeChannel(channel);
            // Fall back to polling after giving up on realtime
            startPolling();
          }
        } else {
          setConnected(false);
        }
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
      setConnected(false);
      stopPolling();
    };
  }, [table, event, filter, startPolling, stopPolling]);

  return { connected };
}
