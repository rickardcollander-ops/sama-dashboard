import { useEffect, useRef, useState } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

interface UseRealtimeOptions<T> {
  table: string;
  event?: RealtimeEvent;
  filter?: string;
  onInsert?: (payload: T) => void;
  onUpdate?: (payload: T) => void;
  onDelete?: (payload: T) => void;
}

/**
 * Subscribe to Supabase Realtime changes on a table.
 * Gracefully disabled when Supabase credentials are missing.
 */
export function useRealtimeSubscription<T extends { id: string }>({
  table,
  event = '*',
  filter,
  onInsert,
  onUpdate,
  onDelete,
}: UseRealtimeOptions<T>) {
  const [connected, setConnected] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const onInsertRef = useRef(onInsert);
  const onUpdateRef = useRef(onUpdate);
  const onDeleteRef = useRef(onDelete);
  onInsertRef.current = onInsert;
  onUpdateRef.current = onUpdate;
  onDeleteRef.current = onDelete;

  useEffect(() => {
    // Don't subscribe if Supabase isn't properly configured
    if (!isSupabaseConfigured) return;

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
          retryCount = 0;
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setConnected(false);
          retryCount++;
          // Stop retrying after MAX_RETRIES to prevent console spam
          if (retryCount >= MAX_RETRIES) {
            console.warn(`[realtime] Gave up on ${channelName} after ${MAX_RETRIES} retries`);
            supabase.removeChannel(channel);
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
    };
  }, [table, event, filter]);

  return { connected };
}
