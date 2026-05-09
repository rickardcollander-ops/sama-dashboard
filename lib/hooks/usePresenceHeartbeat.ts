"use client";

import { useEffect } from "react";
import { useUser } from "@/lib/hooks/useUser";

const HEARTBEAT_INTERVAL_MS = 30_000;

async function ping() {
  try {
    await fetch("/api/presence/heartbeat", {
      method: "POST",
      cache: "no-store",
      keepalive: true,
    });
  } catch {
    // Network blips are fine — the next tick will catch up.
  }
}

export function usePresenceHeartbeat() {
  const { user } = useUser();

  useEffect(() => {
    if (!user) return;

    void ping();
    const interval = setInterval(() => void ping(), HEARTBEAT_INTERVAL_MS);

    const onVisibility = () => {
      if (document.visibilityState === "visible") void ping();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [user]);
}
