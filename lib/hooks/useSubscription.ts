"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";

/**
 * Subscription / trial / admin-grant state for the current user.
 *
 * Mirrors the shape returned by the backend's GET /api/subscriptions/status
 * (see sama-agent/shared/subscription.py AccessStatus.to_dict). Consumed by
 * the billing page, the pricing page, and the trial banner in the customer
 * portal layout.
 */
export interface SubscriptionStatus {
  plan: string;                        // always "site" with per-site pricing
  status: string;                      // trial | active | trialing | past_due | admin_granted | canceled | expired
  has_access: boolean;
  trial_ends_at: string | null;
  trial_days_remaining: number;
  admin_granted_until: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  blocked_reason: string | null;
  current_period_end: string | null;
  site_count: number;
  quantity: number;
  unit_price_usd: number;
  monthly_total_usd: number;
}

interface UseSubscription {
  status: SubscriptionStatus | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useSubscription(): UseSubscription {
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<SubscriptionStatus>("/api/subscriptions/status");
      setStatus(data);
    } catch (e) {
      // 401 just means the user isn't signed in yet — surface as null status.
      if (e instanceof ApiError && e.status === 401) {
        setStatus(null);
      } else {
        setError(e instanceof Error ? e.message : "Failed to load subscription");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { status, loading, error, refresh };
}
