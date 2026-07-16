// Plan gating for the Business OS. Free stores get a basic storefront (list +
// receive orders/bookings); the full management system is Pro. Enforced BOTH
// server-side (migration 0079 caps free products; each Pro page redirects to the
// upsell) and in the UI (locked tiles + upgrade prompts).

export const FREE_PRODUCT_LIMIT = 3;
export const PRO_PRICE_MONTHLY = 15;
export const PRO_PRICE_YEARLY = 150;

// Modules that require Pro. Everything else (home, items, orders, bookings,
// settings, edit, subscription) is available on the free plan.
export const PRO_MODULES = new Set<string>([
  "pos",
  "inventory",
  "customers",
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
