import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

interface UseRealtimeOptions<T> {
  table: string;
  event?: RealtimeEvent;
  filter?: string; // e.g. "status=eq.pending"
  onInsert?: (payload: T) => void;
  onUpdate?: (payload: T) => void;
  onDelete?: (payload: T) => void;
}

/**
 * Subscribe to Supabase Realtime changes on a table.
 *
 * Returns a `connected` boolean so the UI can show a "Live" indicator.
 *
 * Usage:
 *   const { connected } = useRealtimeSubscription<PendingAction>({
 *     table: 'agent_actions',
 *     filter: 'status=eq.pending',
 *     onInsert: (row) => setActions(prev => [row, ...prev]),
 *     onUpdate: (row) => setActions(prev => prev.map(a => a.id === row.id ? row : a)),
 *     onDelete: (row) => setActions(prev => prev.filter(a => a.id !== row.id)),
 *   });
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

  // Stable callback refs to avoid re-subscribing on every render
  const onInsertRef = useRef(onInsert);
  const onUpdateRef = useRef(onUpdate);
  const onDeleteRef = useRef(onDelete);
  onInsertRef.current = onInsert;
  onUpdateRef.current = onUpdate;
  onDeleteRef.current = onDelete;

  useEffect(() => {
    // Don't subscribe if Supabase isn't configured
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return;

    const channelName = `realtime-${table}-${filter || 'all'}`;

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
        setConnected(status === 'SUBSCRIBED');
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
