// Plan gating for the Business OS. Free stores get a basic storefront (list +
// receive orders/bookings); the full management system is Pro. Enforced BOTH
// server-side (migration 0079 caps free products; each Pro page redirects to the
// upsell) and in the UI (locked tiles + upgrade prompts).

export const FREE_PRODUCT_LIMIT = 3;

// Effective (charged) prices after the launch discount.
export const PRO_PRICE_MONTHLY = 30;
export const PRO_PRICE_YEARLY = 150;

// List (pre-discount) prices — shown struck through next to the effective price.
export const PRO_PRICE_MONTHLY_LIST = 60;
export const PRO_PRICE_YEARLY_LIST = 600;

// Launch discount percentages (list -> effective).
export const PRO_MONTHLY_DISCOUNT_PCT = 50;
export const PRO_YEARLY_DISCOUNT_PCT = 75;

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

export function isPro(plan: string | null | undefined): boolean {
  return plan === "pro";
}
