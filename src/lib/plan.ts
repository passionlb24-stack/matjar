// Plan gating for the Business OS. Free stores get a basic storefront (list +
// receive orders/bookings); the full management system is Pro. Enforced BOTH
// server-side (migration 0079 caps free products; each Pro page redirects to the
// upsell) and in the UI (locked tiles + upgrade prompts).

import { hasPlan } from "@/lib/plan-tiers";

export const FREE_PRODUCT_LIMIT = 3;

// NOTE: subscription prices live in ONE place — src/lib/plan-tiers.ts
// (PLAN_TIERS + promoState/annualPrice). Do not re-declare prices here; the old
// PRO_PRICE_* constants were removed to stop the card/subscription/pricing pages
// disagreeing (they showed $15 / $30 / $25 for the same Pro plan).

// Free trial length for new stores (Pro features unlocked, no charge).
export const TRIAL_DAYS = 14;

// Modules that require Pro. Everything else (home, items, orders, bookings,
// settings, edit, subscription) is available on the free plan.
export const PRO_MODULES = new Set<string>([
  "pos",
  "inventory",
  "customers",
  "campaigns",
  "automations",
  "suppliers",
  "tasks",
  "accounting",
  "reports",
  "coupons",
  "staff",
  "kitchen",
  "doctors",
]);

export function isProModule(key: string): boolean {
  return PRO_MODULES.has(key);
}

// Tier checks are rank-based: a Business store also satisfies isPro. Kept here
// (delegating to plan-tiers) so existing `isPro(getStorePlan())` call sites work
// across the new Basic/Pro/Business tiers.
export function isPro(plan: string | null | undefined): boolean {
  return hasPlan(plan, "pro");
}

export function isBusiness(plan: string | null | undefined): boolean {
  return hasPlan(plan, "business");
}

export {
  hasPlan,
  planRank,
  planProductLimit,
  planStaffLimit,
} from "@/lib/plan-tiers";
