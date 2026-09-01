import { createClient } from "@/lib/supabase/server";
import type { Locale } from "@/i18n/config";
import type {
  PortfolioItem,
  PricingMode,
  ProfessionalProfile,
  ProfessionalReview,
  ProfessionalService,
} from "@/lib/professional";
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

/* ────────────────────────────────────────────────────────────────────────── *
 * Browse results, in the shared card shape.
 *
 * `browse_crafts` returns a finished card row; ProfessionalCard wants a
 * ProfessionalProfile. This is the seam, and it is deliberately lossy in
 * exactly one place, stated here so nobody has to rediscover it:
 *
 *   the RPC returns `from_price` — the cheapest of the provider's listed
 *   services — but not the service it came from, and ProfessionalProfile has
 *   nowhere to put a floor price except inside `services`, which
 *   startingPrice() then reads. Inventing a one-line service row to carry the
 *   number would put a service on the card that the tradesman never listed. So
 *   the number is dropped from the browse card rather than dressed up, and the
 *   two honest fixes are named in the report: teach `browse_crafts` to return
 *   the cheapest service's name and pricing mode, or give ProfessionalProfile
 *   an explicit starting-price field. Both belong to the shared engine.
 * ────────────────────────────────────────────────────────────────────────── */
export async function browseCraftsAsProfiles(
  opts: Parameters<typeof browseCrafts>[0],
  lang: Locale,
): Promise<ProfessionalProfile[]> {
  const rows = await browseCrafts(opts);
  const ar = lang === "ar";
  return rows.map((p) => {
    const ratingCount = p.rating_count ?? 0;
    const years = p.years_experience ?? 0;
    return {
      kind: "craft" as const,
      id: p.id,
      name: p.name,
      headline: p.headline,
      photoUrl: p.photo_url,
      specialties: p.trades.map((t) => (ar ? t.name_ar : t.name_en)),
      skills: [],
      languages: [],
      yearsExperience: years > 0 ? years : null,
      trust: p.verified ? { identityVerified: true } : {},
      area: {
        region: p.region,
        areas: p.service_areas.map((a) => (ar ? a.name_ar : a.name_en)),
        ...(p.service_areas.length > 0 ? { onSite: true } : {}),
      },
      services: [],
      portfolio: [],
      reviews: [],
      ratingAvg: ratingCount > 0 ? p.rating_avg : null,
      ratingCount,
    };
  });
}

/* ────────────────────────────────────────────────────────────────────────── *
 * How many tradesmen actually exist.
 *
 * Not a vanity number — the crafts landing page has to choose between showing
 * a marketplace and showing the truth, and this is the fact that decides it.
 * `head: true` so it is a COUNT and not a page of rows; the public read policy
 * is `status = 'active'`, so an unapproved profile is no more counted here
 * than it is browsable.
 * ────────────────────────────────────────────────────────────────────────── */
export async function countActiveProviders(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("craft_providers")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");
  return count ?? 0;
}

/* ────────────────────────────────────────────────────────────────────────── *
 * craft_* rows → the shared ProfessionalProfile shape.
 *
 * This is the whole reason the crafts profile route can be written today for a
 * table with zero rows in it: the page is written against the shared contract
 * and this function is the only code that knows craft column names. When the
 * first tradesman signs up, nothing in the page has to change.
 *
 * Two mappings are worth stating out loud, because both are places a
 * well-meaning resolver would invent something:
 *
 *   `hours` is `jsonb NOT NULL` with an empty-object default, so `hours != null`
 *   — which is exactly what profileBlocks() tests for the availability block —
 *   is true for every provider ever created. An empty object is not opening
 *   hours. It is normalised to undefined here so the block stays absent until
 *   someone actually keeps hours.
 *
 *   `pricing_type` allows 'per_meter' and PricingMode has no per-unit member.
 *   Mapping it to 'from' would turn "$12 the square metre" into "starts from
 *   $12" on the card and inside startingPrice() — a number a customer reads as
 *   the price of the job. It degrades to 'quote_required' instead, which costs
 *   the number and keeps the truth. The real fix is one more member on
 *   PricingMode, which lives in the shared engine and not here.
 * ────────────────────────────────────────────────────────────────────────── */

const PRICING_MODE: Record<string, PricingMode> = {
  fixed: "fixed",
  from: "from",
  hourly: "hourly",
  quote: "quote_required",
  per_meter: "quote_required",
};

type TradeName = { slug: string; name_ar: string; name_en: string };

/** The provider's own contact affordances. Never an address — craft_providers
 *  has no address column, and §36 is the reason it was never given one. */
export type CraftContact = { phone: string | null; whatsapp: string | null };

export type CraftProfessional = {
  profile: ProfessionalProfile;
  contact: CraftContact;
  /** Trade slugs, for the "more of this trade" links the profile offers. */
  tradeSlugs: string[];
};

function nonEmptyObject(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value as Record<string, unknown>).length > 0
  );
}

/** Shape of one craft_providers row with its embeds, as PostgREST returns it.
 *  Written out so the mapper below is checked rather than cast field by
 *  field — the row itself still arrives as `unknown` from the client. */
export type CraftProviderRow = {
  id: string;
  name: string;
  headline: string | null;
  bio: string | null;
  photo_url: string | null;
  phone: string | null;
  whatsapp: string | null;
  years_experience: number | null;
  region: string | null;
  status: string;
  verified: boolean;
  hours: unknown;
  rating_avg: number | null;
  rating_count: number | null;
  completed_count: number | null;
  lb_areas: { name_ar: string; name_en: string } | null;
  craft_provider_trades: { trades: TradeName | null }[] | null;
  craft_provider_areas: { lb_areas: TradeName | null }[] | null;
  craft_services:
    | {
        id: string;
        name: string;
        description: string | null;
        pricing_type: string;
        price: number | null;
        duration_minutes: number | null;
        sort_order: number;
      }[]
    | null;
  craft_works:
    | { id: string; title: string | null; image_url: string; sort_order: number }[]
    | null;
  craft_reviews:
    | {
        id: string;
        rating: number;
        comment: string | null;
        customer_name: string | null;
        created_at: string;
      }[]
    | null;
};

/**
 * The pure half of {@link getCraftProfessional}, exported so it can be tested
 * against a fixture. There is not one row in craft_providers on production, so
 * a fixture is the only honest way to prove this mapping at all — see
 * src/lib/data/crafts.test.ts.
 */
export function toCraftProfessional(
  p: CraftProviderRow,
  lang: Locale,
): CraftProfessional {
  const ar = lang === "ar";
  const label = (t: TradeName) => (ar ? t.name_ar : t.name_en);

  const trades = (p.craft_provider_trades ?? [])
    .map((r) => r.trades)
    .filter((t): t is TradeName => t !== null);

  const areas = (p.craft_provider_areas ?? [])
    .map((r) => r.lb_areas)
    .filter((a): a is TradeName => a !== null);

  const services: ProfessionalService[] = (p.craft_services ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((s) => {
      const mode = PRICING_MODE[s.pricing_type] ?? "quote_required";
      return {
        id: s.id,
        name: s.name,
        description: s.description,
        price: {
          mode,
          // Absent is absent: a quoted service carries no number rather than a
          // zero, which would render as free.
          amount: mode === "quote_required" ? null : s.price,
          durationMinutes: s.duration_minutes,
        },
      };
    });

  const portfolio: PortfolioItem[] = (p.craft_works ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((w) => ({
      id: w.id,
      title: w.title,
      imageUrl: w.image_url,
      // Self-uploaded. `viaMatjar` is the platform vouching that the job ran
      // through it, and craft_works records nothing of the sort.
      viaMatjar: false,
    }));

  const reviews: ProfessionalReview[] = (p.craft_reviews ?? [])
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      customerName: r.customer_name,
      createdAt: r.created_at,
      // Every craft review hangs off a request the tradesman marked completed —
      // craft_reviews_write (0239) permits no other kind. So this is a
      // statement about how the row got here, not a claim about the job.
      verifiedJob: true,
    }));

  const ratingCount = Number(p.rating_count ?? 0);
  const completed = Number(p.completed_count ?? 0);
  const years = Number(p.years_experience ?? 0);

  const profile: ProfessionalProfile = {
    kind: "craft",
    id: p.id,
    name: p.name,
    headline: p.headline,
    bio: p.bio,
    photoUrl: p.photo_url,
    specialties: trades.map(label),
    // Crafts have no skills or languages table. Empty means the block does not
    // render, which is the right answer rather than a guess.
    skills: [],
    languages: [],
    yearsExperience: years > 0 ? years : null,
    trust: {
      // `verified` is set by an admin against a document (adminVerify), so it
      // is an identity check and not a subscription. Crafts has no paid tier,
      // which is why `pro` is absent rather than false.
      ...(p.verified === true ? { identityVerified: true } : {}),
    },
    area: {
      // Region and covered areas — never where they live. A tradesman is
      // usually a person working out of their own home (§36), and the schema
      // keeps coverage and residence apart on purpose.
      region:
        p.region ?? (p.lb_areas ? (ar ? p.lb_areas.name_ar : p.lb_areas.name_en) : null),
      areas: areas.map(label),
      ...(areas.length > 0 ? { onSite: true } : {}),
    },
    services,
    portfolio,
    reviews,
    ratingAvg: ratingCount > 0 ? Number(p.rating_avg ?? 0) : null,
    ratingCount,
    completedCount: completed > 0 ? completed : null,
    hours: nonEmptyObject(p.hours) ? p.hours : undefined,
  };

  return {
    profile,
    contact: {
      phone: (p.phone ?? "").trim() || null,
      whatsapp: (p.whatsapp ?? "").trim() || null,
    },
    tradeSlugs: trades.map((t) => t.slug),
  };
}

/** One tradesman, resolved into the shared shape. `null` when they do not
 *  exist or are not published — an owner previewing their own pending profile
 *  gets the same answer a stranger does. */
export async function getCraftProfessional(
  id: string,
  lang: Locale,
): Promise<CraftProfessional | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("craft_providers")
    .select(
      // lb_areas is reachable two ways from here — the provider's own base area
      // and the areas they cover — so the foreign key is named explicitly.
      // Without it PostgREST cannot pick one, the request errors, and the page
      // 404s as though the provider did not exist.
      `id, name, headline, bio, photo_url, phone, whatsapp, years_experience,
       region, status, verified, hours, rating_avg, rating_count, completed_count,
       lb_areas!craft_providers_area_id_fkey(name_ar, name_en),
       craft_provider_trades(trades(slug, name_ar, name_en)),
       craft_provider_areas(lb_areas(slug, name_ar, name_en)),
       craft_services(id, name, description, pricing_type, price, duration_minutes, sort_order),
       craft_works(id, title, image_url, sort_order),
       craft_reviews(id, rating, comment, customer_name, created_at)`,
    )
    .eq("id", id)
    .maybeSingle();

  // A malformed embed fails the whole request and returns no row, which is
  // indistinguishable from "no such provider" — this page 404'd for a live,
  // published tradesman until the ambiguous lb_areas join above was named.
  if (error) {
    console.error("craft provider load failed", { id, message: error.message });
    return null;
  }
  const row = data as unknown as CraftProviderRow | null;
  // RLS already hides everything but `active` from the public; saying it again
  // here keeps an owner's own pending profile out of their public preview.
  if (!row || row.status !== "active") return null;
  return toCraftProfessional(row, lang);
}
