import { createClient } from "@/lib/supabase/server";
import { FETCH_BOUNDS, warnIfTruncated } from "./bounds";

// Data access for the crafts directory.
//
// Everything here reads through the RPCs added in 0237 rather than assembling
// joins in the page, for one reason: a provider card needs their trades, their
// coverage, their rating and their cheapest listed price, and doing that from
// the client is one query per provider. browse_crafts returns the finished
// card.

export type TradeRef = {
  slug: string;
  name_ar: string;
  name_en: string;
  icon: string | null;
};

export type AreaRef = { slug: string; name_ar: string; name_en: string };

export type CraftProvider = {
  id: string;
  name: string;
  headline: string | null;
  photo_url: string | null;
  kind: "individual" | "business";
  area: string | null;
  region: string | null;
  years_experience: number | null;
  rating_avg: number | null;
  rating_count: number | null;
  verified: boolean;
  has_whatsapp: boolean;
  trades: TradeRef[];
  service_areas: AreaRef[];
  from_price: number | null;
  works_count: number | null;
};

export type TradeGroup = {
  slug: string;
  name_ar: string;
  name_en: string;
  icon: string | null;
  trades: (TradeRef & { group_slug: string })[];
};

/**
 * How many providers each trade has, so the landing page can lead with the
 * trades that can actually answer — and quietly not lead with the empty ones.
 */
export async function getTradeCounts(): Promise<Record<string, number>> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("trade_provider_counts");
  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as { slug: string; n: number }[]) {
    counts[row.slug] = row.n;
  }
  return counts;
}

/** The full taxonomy, grouped, for the directory landing page. */
export async function getTradeGroups(): Promise<TradeGroup[]> {
  const supabase = await createClient();
  const [{ data: groups }, { data: trades }] = await Promise.all([
    supabase
      .from("trade_groups")
      .select("slug, name_ar, name_en, icon")
      .eq("active", true)
      .order("sort_order")
      .limit(FETCH_BOUNDS.referenceRows),
    supabase
      .from("trades")
      .select("slug, name_ar, name_en, icon, group_slug")
      .eq("active", true)
      .order("sort_order")
      .limit(FETCH_BOUNDS.referenceRows),
  ]);
  warnIfTruncated(groups, FETCH_BOUNDS.referenceRows, "trade_groups");
  warnIfTruncated(trades, FETCH_BOUNDS.referenceRows, "trades");

  const byGroup = new Map<string, (TradeRef & { group_slug: string })[]>();
  for (const t of (trades ?? []) as (TradeRef & { group_slug: string })[]) {
    const list = byGroup.get(t.group_slug) ?? [];
    list.push(t);
    byGroup.set(t.group_slug, list);
  }

  return ((groups ?? []) as Omit<TradeGroup, "trades">[]).map((g) => ({
    ...g,
    trades: byGroup.get(g.slug) ?? [],
  }));
}

/** Areas, grouped by the region they sit under. */
export async function getAreasByRegion(): Promise<Record<string, AreaRef[]>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lb_areas")
    .select("slug, region, name_ar, name_en")
    .order("sort_order")
    .limit(FETCH_BOUNDS.referenceRows);
  // Lebanon's area list is the one reference table close enough to PostgREST's
  // default 1000-row cap for the silent truncation to have been a live risk.
  warnIfTruncated(data, FETCH_BOUNDS.referenceRows, "lb_areas");

  const out: Record<string, AreaRef[]> = {};
  for (const a of (data ?? []) as (AreaRef & { region: string })[]) {
    (out[a.region] ??= []).push({
      slug: a.slug,
      name_ar: a.name_ar,
      name_en: a.name_en,
    });
  }
  return out;
}

export async function getTrade(
  slug: string,
): Promise<(TradeRef & { group_slug: string }) | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("trades")
    .select("slug, name_ar, name_en, icon, group_slug")
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();
  return (data as (TradeRef & { group_slug: string }) | null) ?? null;
}

export async function browseCrafts(opts: {
  trade?: string | null;
  area?: string | null;
  region?: string | null;
  q?: string | null;
  sort?: string | null;
  limit?: number;
}): Promise<CraftProvider[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("browse_crafts", {
    p_trade: opts.trade || null,
    p_area: opts.area || null,
    p_region: opts.region || null,
    p_q: opts.q || null,
    p_sort: opts.sort || "rating",
    p_limit: opts.limit ?? 40,
  });
  return (data ?? []) as CraftProvider[];
}
