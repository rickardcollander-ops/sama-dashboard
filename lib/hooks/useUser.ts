"use client";

import { useSyncExternalStore } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

const isSupabaseConfigured = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

interface AuthState {
  user: User | null;
  loading: boolean;
}

// Module-level singleton. useUser() is consumed by ~30 components/hooks, many
// of which mount on the same page. The previous per-hook implementation made
// each consumer run its own getUser() (a network round-trip to the auth server)
// while holding the @supabase/gotrue-js navigator LockManager lock. With a
// dozen consumers contending for one lock — and the network call inside it
// occasionally failing — every acquisition waited out the 5000ms lock timeout
// before stealing it, stalling the page for seconds. Sharing one store +
// one auth subscription collapses that to a single cached-session read.
let state: AuthState = { user: null, loading: isSupabaseConfigured };
const listeners = new Set<() => void>();
let initialized = false;

function emit(next: AuthState) {
  // Re-render only when auth status meaningfully changes: loading flag flips,
  // user goes null↔present, or the signed-in identity switches. Ignoring
  // TOKEN_REFRESHED events (same user.id, new token object reference) avoids
  // cascading re-renders of all ~30 consumers on every hourly token refresh.
  if (
    next.loading === state.loading &&
    next.user?.id === state.user?.id
  ) return;
  state = next;
  listeners.forEach((l) => l());
}

function init() {
  if (initialized) return;
  initialized = true;
  if (!isSupabaseConfigured) {
    state = { user: null, loading: false };
    return;
  }
  const supabase = getSupabaseBrowser();
  // INITIAL_SESSION fires from local storage (no network, minimal lock hold),
  // followed by SIGNED_IN / SIGNED_OUT / TOKEN_REFRESHED. We deliberately avoid
  // getUser() on the client — token validation against the auth server is the
  // server's job (API routes already call getUser()). autoRefreshToken keeps
  // the cached session current.
  supabase.auth.onAuthStateChange((_event, session) => {
    emit({ user: session?.user ?? null, loading: false });
  });
}

function subscribe(listener: () => void): () => void {
  init();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): AuthState {
  return state;
}

function getServerSnapshot(): AuthState {
  return { user: null, loading: isSupabaseConfigured };
}

export function useUser() {
  const { user, loading } = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const signOut = async () => {
    if (isSupabaseConfigured) {
      await getSupabaseBrowser().auth.signOut();
    }
    window.location.href = "/c/login";
  };

  return { user, loading, signOut, isSupabaseConfigured };
}
