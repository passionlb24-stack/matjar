import "server-only";
import { createClient } from "@/lib/supabase/server";
import { toCategoryKey, type CategoryKey } from "@/lib/catalog";
import { sectorPrimarySetup } from "@/lib/sectors";
import { effectivePlan, hasPlan } from "@/lib/plan-tiers";
import { publishStage, type PublishStage } from "@/lib/store-onboarding";
import { SITE_URL } from "@/lib/site";

// ===== Where this store actually stands =====
//
// The OS home already knows all of this — it fetches the store row, counts the
// catalogue and hands both to the checklist. Every other module page knew none
// of it, which is why they all said the same sentence ("no orders yet") to three
// merchants in genuinely different situations:
//
//   • a store still in review, whose page nobody can reach at all;
//   • a live store with an empty catalogue, which has nothing to be ordered;
//   • a live store with a full catalogue and no traffic.
//
// Only the third one is a marketing problem, and only the second one should be
// told to add a product. Counted on production, 2026-08-20: of 15 active stores
// 12 have never taken an order or a booking and 4 have no catalogue at all;
// across all 36 stores, 16 have no catalogue. Every one of those merchants was
// being handed the same sentence.
//
// Resolved lazily, and only by empty states: a page with rows to show never
// calls this, so it costs nothing on the screens that are working.

/** `live` | `blocked` | `review`, straight from `publishStage`. "setup" never
 *  reaches here — see the call site for why readiness is not a question this
 *  surface asks. */
export type StoreStage = PublishStage;

export type StoreReadiness = {
  stage: StoreStage;
  storeName: string;
  /** The sector, so callers need not widen their own query to learn it. */
  category: CategoryKey;
  /** Public storefront path, or null while nothing public exists. */
  storePath: string | null;
  /** Absolute URL for sharing — null for the same reason. */
  storeUrl: string | null;
  /** Products, rooms, ticket types: whatever this sector actually sells. */
  offerings: number;
  /** Trial-aware effective plan, so an empty state never offers a locked tool. */
  plan: string;
};

/**
 * The facts an empty state needs to say something true. Two cheap queries, run
 * only when a module has nothing to render.
 */
export async function getStoreReadiness(
  lang: string,
  storeId: string,
): Promise<StoreReadiness | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("stores")
    .select("name, slug, status, plan, trial_ends_at, business_types(slug)")
    .eq("id", storeId)
    .maybeSingle();

  const s = data as unknown as {
    name: string;
    slug: string | null;
    status: string;
    plan: string | null;
    trial_ends_at: string | null;
    business_types: { slug: string } | null;
  } | null;
  if (!s) return null;

  const category = toCategoryKey(s.business_types?.slug, `store ${storeId}`);

  // The core entity is `products` for most sectors; a hotel's readiness hangs
  // on its rooms and an organiser's on its ticket types, which is the same rule
  // the OS home's completeness already follows.
  const primary = sectorPrimarySetup(category);
  const countRes = primary
    ? await supabase
        .from(primary.table)
        .select("id", { count: "exact", head: true })
        .eq("store_id", storeId)
    : await supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("store_id", storeId)
        .is("deleted_at", null);

  // The one status rule, reused rather than re-derived. `readyToPublish` is
  // passed as true deliberately: whether the merchant has finished their own
  // checklist is a question the OS home asks and this surface does not — an
  // empty orders list needs to know only whether a public page exists, and
  // `publishStage` returns "setup" solely to distinguish unfinished work. A
  // second copy of "suspended or rejected means stopped" living here is exactly
  // how the two would drift.
  const stage = publishStage(s.status, true);

  // A link is only offered when one exists: stores_select exposes active rows
  // only, so a path built for a store in review points at a 404 — the same trap
  // the OS home's share card was fixed for.
  const storePath =
    stage === "live" ? `/${lang}/${s.slug ?? `store/${storeId}`}` : null;

  return {
    stage,
    storeName: s.name,
    category,
    storePath,
    storeUrl: storePath ? `${SITE_URL}${storePath}` : null,
    offerings: countRes.count ?? 0,
    plan: effectivePlan(s.plan, s.trial_ends_at),
  };
}

/** Whether a tool may be offered as a next step, or would open onto a paywall. */
export function canOffer(
  readiness: StoreReadiness,
  minPlan: "pro" | "business",
): boolean {
  return hasPlan(readiness.plan, minPlan);
}
