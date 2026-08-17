"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Navigation, Loader2, Package } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { nearestDistance } from "@/lib/geo";
import { getCurrentPosition } from "@/lib/native";
import { createClient } from "@/lib/supabase/client";
import { resolveSearch, type SearchAnswer } from "@/lib/search-state";
import type { DiscoveryStore } from "@/lib/data/discovery";
import { StoreCard } from "@/components/store-card";
import { ProductMiniCard } from "@/components/product-mini-card";

// A product hit from the search_products_fuzzy RPC (migration 0114).
type ProductHit = {
  id: string;
  name: string;
  name_en: string | null;
  price: number;
  discount_price: number | null;
  image_url: string | null;
  store_id: string;
  store_name: string;
};

/**
 * The result set of a discovery page.
 *
 * Filtering, sorting and paging happen on the server against the query string —
 * this component no longer owns any of it. What is left is the two things that
 * genuinely cannot live in a URL: a product-name search that runs against an
 * RPC, and a distance ranking that depends on where the viewer is standing. A
 * "nearest to you" link is not shareable, so it is deliberately not URL state.
 */
export function ExploreClient({
  lang,
  dict,
  stores,
  lbpRate,
  term,
}: {
  lang: Locale;
  dict: Pick<Dictionary, "explore" | "catalog" | "featured" | "discovery">;
  stores: DiscoveryStore[];
  lbpRate: number;
  /** The committed search term from the URL. */
  term: string;
}) {
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const supabase = useMemo(() => createClient(), []);
  // The answer is stored WITH the term it answers, which is what makes both
  // "is this still loading" and "are these hits stale" derivable rather than
  // separate flags an effect has to keep in step.
  const [answer, setAnswer] = useState<SearchAnswer<ProductHit> | null>(null);
  const latestTermRef = useRef("");

  const {
    term: query,
    active: productSearchOn,
    results: productResults,
    searching,
  } = resolveSearch<ProductHit>(term, answer);

  useEffect(() => {
    latestTermRef.current = query;
    if (!productSearchOn) return;
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase.rpc("search_products_fuzzy", {
        p_q: query,
      });
      if (cancelled || latestTermRef.current !== query) return;
      const hits = error ? null : ((data ?? []) as ProductHit[]);
      setAnswer({ term: query, hits });

      // A zero here is the whole point: a search that found nothing is demand
      // Matjar cannot serve yet, and it is the only signal that says which
      // merchant to go and recruit. Never awaited: logging must not slow search.
      void supabase.rpc("log_search", {
        p_q: query,
        p_section: "products",
        p_results: hits?.length ?? 0,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [query, productSearchOn, supabase]);

  async function findNearMe() {
    setLocating(true);
    setGeoError(null);
    try {
      setUserLoc(await getCurrentPosition());
    } catch {
      setGeoError(dict.explore.locationError);
    } finally {
      setLocating(false);
    }
  }

  // Only offer the distance ranking when something on this page can be ranked.
  // Five of Matjar's stores have coordinates; asking a buyer for their location
  // to sort a page where no result can carry a distance is a permission prompt
  // spent on nothing.
  const rankable = stores.some(
    (s) =>
      (s.lat != null && s.lng != null) ||
      s.locations?.some((l) => l.lat != null && l.lng != null),
  );

  const displayed = useMemo(() => {
    if (!userLoc) return stores;
    const withDistance = stores.map((s) => ({
      ...s,
      distanceKm: nearestDistance(s, userLoc.lat, userLoc.lng),
    }));
    // Stable sort: stores with no coordinates keep the server's order at the end
    // rather than being shuffled into a fake nearness.
    return withDistance.sort(
      (a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity),
    );
  }, [stores, userLoc]);

  return (
    <div className="space-y-6">
      {rankable && (
        <div>
          <button
            type="button"
            onClick={() => void findNearMe()}
            disabled={locating}
            aria-pressed={userLoc != null}
            className={`inline-flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors disabled:opacity-60 ${
              userLoc
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-surface text-foreground hover:border-primary/40"
            }`}
          >
            {locating ? (
              <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
            ) : (
              <Navigation aria-hidden className="h-4 w-4" />
            )}
            {locating ? dict.explore.locating : dict.explore.nearest}
          </button>
          {geoError && (
            <p className="mt-2 text-sm font-medium text-danger">{geoError}</p>
          )}
        </div>
      )}

      {searching && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
          {dict.explore.matchingProducts}
        </p>
      )}

      {productResults && productResults.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-extrabold">
            <Package aria-hidden className="h-5 w-5 text-primary" />
            {dict.explore.matchingProducts}
            <span className="text-sm font-medium text-muted-foreground tabular-nums">
              ({productResults.length})
            </span>
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {productResults.map((p) => (
              <ProductMiniCard
                key={p.id}
                lang={lang}
                id={p.id}
                name={p.name}
                nameEn={p.name_en}
                price={Number(p.price)}
                discountPrice={
                  p.discount_price != null ? Number(p.discount_price) : null
                }
                imageUrl={p.image_url}
                storeName={p.store_name}
                lbpRate={lbpRate}
              />
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {displayed.map((s) => (
          <StoreCard
            key={s.id}
            store={s}
            lang={lang}
            dict={dict}
            facts={s.facts}
            factsDict={dict.discovery}
          />
        ))}
      </div>
    </div>
  );
}
