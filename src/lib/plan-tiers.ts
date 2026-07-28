// Matjar subscription tiers + the August-2026 annual promo. Everything is driven
// off PROMO_END — after it passes, annual prices automatically revert to
// standard (monthly × 12) and the promo UI hides itself. No manual flag to flip.
// (Not to be confused with lib/pricing.ts, which is per-PRODUCT pricing.)

export type PlanKey = "basic" | "pro" | "business";

export type PlanConfig = {
  monthly: number;
  annualPromo: number;
  annualStandard: number;
  /** null = unlimited */
  products: number | null;
  staff: number;
  savingsPct: number;
  popular?: boolean;
};

export const PROMO_END = "2026-08-31T23:59:59+03:00"; // Asia/Beirut

export const PLAN_TIERS: Record<PlanKey, PlanConfig> = {
  basic: {
    monthly: 10,
    annualPromo: 75,
    annualStandard: 120,
    products: 30,
    staff: 1,
    savingsPct: 38,
  },
  pro: {
    monthly: 25,
    annualPromo: 150,
    annualStandard: 300,
    products: 200,
    staff: 3,
    savingsPct: 50,
    popular: true,
  },
  business: {
    monthly: 65,
    annualPromo: 300,
    annualStandard: 780,
    products: null,
    staff: 10,
    savingsPct: 62,
  },
};

export const PLAN_ORDER: PlanKey[] = ["basic", "pro", "business"];

// Promo state for a given instant (pass the server's `new Date()` so the page
// re-evaluates per request). daysLeft is ceil'd so "ends in 1 day" shows until
// the final moment.
export function promoState(now: Date): { active: boolean; daysLeft: number } {
  const end = new Date(PROMO_END).getTime();
  const active = now.getTime() <= end;
  const daysLeft = active
    ? Math.max(1, Math.ceil((end - now.getTime()) / 86_400_000))
    : 0;
  return { active, daysLeft };
}

// The annual price to show/charge: promo price during the window, else standard.
export function annualPrice(plan: PlanConfig, promoActive: boolean): number {
  return promoActive ? plan.annualPromo : plan.annualStandard;
}

// ── Tier enforcement ─────────────────────────────────────────────────────────
// 'free' is the lapsed/entry floor (never subscribed / trial expired). Paid
// tiers rank above it. A store "has" a tier if its rank meets the requirement.
export type StorePlan = "free" | "basic" | "pro" | "business";

export const PLAN_RANK: Record<string, number> = {
  free: 0,
  basic: 1,
  pro: 2,
  business: 3,
};

export function planRank(plan?: string | null): number {
  return PLAN_RANK[plan ?? "free"] ?? 0;
}

export function hasPlan(
  current: string | null | undefined,
  required: "basic" | "pro" | "business",
): boolean {
  return planRank(current) >= PLAN_RANK[required];
}

// Catalog size cap by plan: free 3, basic 30, pro 200, business unlimited.
export function planProductLimit(plan?: string | null): number {
  const r = planRank(plan);
  return r >= 3 ? Infinity : r === 2 ? 200 : r === 1 ? 30 : 3;
}

// Staff seats by plan (the owner is always seat #1): free/basic 1, pro 3,
// business 10.
export function planStaffLimit(plan?: string | null): number {
  const r = planRank(plan);
  return r >= 3 ? 10 : r === 2 ? 3 : 1;
}
