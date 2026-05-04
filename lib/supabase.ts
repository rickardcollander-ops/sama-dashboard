const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

/** Whether Supabase is properly configured (both URL and key present) */
export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

/** Whether Supabase Realtime is enabled (opt-in via env var) */
export const isRealtimeEnabled =
  isSupabaseConfigured &&
  process.env.NEXT_PUBLIC_SUPABASE_REALTIME !== 'false';
