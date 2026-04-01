# SAMA Dashboard Commercialization

## Overview

The SAMA dashboard has been updated to support commercial SaaS operation. The customer portal (`/c/*`) now includes all the pages needed for a self-service onboarding and usage experience.

## What Changed

### New Customer Portal Pages

| Route | Purpose |
|-------|---------|
| `/c/pricing` | Three-tier pricing page (Starter $149/mo, Growth $399/mo, Enterprise custom) |
| `/c/onboarding` | 5-step setup wizard for new customers (brand info, competitors, API keys, review platforms, launch) |
| `/c/seo` | SEO keyword rankings with position history charts (Recharts) |
| `/c/content` | Content library with status filtering (draft/published) and generation trigger |
| `/c/social` | Social media posts and engagement metrics |
| `/c/analytics` | Cross-channel analytics with daily trends and channel breakdown charts |

### Updated Existing Files

- **`components/CustomerNav.tsx`** -- Expanded navigation with links to all new pages (SEO, Content, Social, Analytics, Plan)
- **`lib/api.ts`** -- Added `tenantApi(tenantId)` helper that injects `X-Tenant-ID` header for multi-tenant API calls
- **`app/c/dashboard/page.tsx`** -- Added onboarding redirect: if the user has no `brand_name` in settings, they are sent to `/c/onboarding`

### Multi-Tenancy Support

All new customer pages use `tenantApi(user.id)` to make API calls with the `X-Tenant-ID` header. This aligns with the backend multi-tenancy work happening in sama-agent.

## How Onboarding Works

1. New user signs up at `/c/login`
2. On first visit to `/c/dashboard`, the app checks for `user_settings` in Supabase
3. If no `brand_name` exists, the user is redirected to `/c/onboarding`
4. The 5-step wizard collects: brand info, competitors, API keys, review platform URLs
5. Data is saved to the `user_settings` table via Supabase upsert
6. User is redirected to `/c/dashboard` after completion

## What's Next

- **Stripe integration**: Connect pricing page CTAs to Stripe Checkout for subscription management
- **Usage metering**: Track content pieces generated, API calls, etc. against plan limits
- **More agent pages**: Ads agent page, review management page
- **Billing portal**: Self-service plan changes, invoices, cancellation
- **Role-based access**: Team member invitations and permission levels
