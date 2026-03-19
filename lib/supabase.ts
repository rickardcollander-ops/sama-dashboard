import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

/** Whether Supabase is properly configured (both URL and key present) */
export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    realtime: {
      params: {
        eventsPerSecond: 2,
      },
    },
    // Disable realtime auto-connect if not configured
    ...(isSupabaseConfigured ? {} : {
      realtime: { params: { eventsPerSecond: 0 } },
    }),
  }
);
