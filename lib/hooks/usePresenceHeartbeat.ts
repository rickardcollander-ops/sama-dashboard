"use client";

import { useEffect } from "react";
import { useUser } from "@/lib/hooks/useUser";

// The heartbeat powers a cosmetic "online" dot. Each ping is a full auth
// round-trip + DB upsert, so we keep it infrequent and skip ticks while the
// tab is hidden — a background tab doesn't need to report itself online. The
// visibilitychange handler fires an immediate ping on resume so the dot is
// fresh the moment the user comes back.
const HEARTBEAT_INTERVAL_MS = 180_000;

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
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") void ping();
    }, HEARTBEAT_INTERVAL_MS);

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
