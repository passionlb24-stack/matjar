"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Navigation,
  Loader2,
  Sparkles,
  Star,
  Clock,
  DoorOpen,
  Package,
  type LucideIcon,
} from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import {
  groupKeys,
  categoryGroup,
  regions,
  type CategoryKey,
  type GroupKey,
  type RegionKey,
  type Store,
} from "@/lib/catalog";
import { nearestDistance } from "@/lib/geo";
import { getCurrentPosition } from "@/lib/native";
import { createClient } from "@/lib/supabase/client";
import { Container } from "@/components/ui/container";
import { StoreCard } from "@/components/store-card";
import { ProductMiniCard } from "@/components/product-mini-card";
import { groupIcons } from "@/components/category-icon";

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

function chipClass(active: boolean) {
  return active
    ? "bg-primary text-primary-foreground border-primary"
    : "bg-surface text-foreground border-border hover:border-primary/40";
}

// Single-select sort/filter modes for the store listing.
//  - recommended: incoming order (server already floats featured to the top).
//  - nearest: needs the buyer's location; ranks by closest branch.
//  - topRated: rating desc, then review count desc.
//  - newest: incoming order == server's created_at desc (no client createdAt).
//  - openNow: filters to open stores, keeping the recommended sub-order.
type SortMode = "recommended" | "nearest" | "topRated" | "newest" | "openNow";

export function ExploreClient({
  lang,
  dict,
  stores,
  lbpRate,
  initialQuery,
  initialCategory = "all",
  initialGroup = "all",
  initialRegion = "all",
}: {
  lang: Locale;
  dict: Dictionary;
  stores: Store[];
  lbpRate: number;
  initialQuery?: string;
  initialCategory?: CategoryKey | "all";
  initialGroup?: GroupKey | "all";
  initialRegion?: RegionKey | "all";
}) {
  const [category, setCategory] = useState<CategoryKey | "all">(initialCategory);
  const [group, setGroup] = useState<GroupKey | "all">(initialGroup);
  const [region, setRegion] = useState<RegionKey | "all">(initialRegion);
  const [query, setQuery] = useState(initialQuery ?? "");
  const [sortMode, setSortMode] = useState<SortMode>("recommended");
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Product-name search: the RPC (migration 0114) returns matching products
  // (name + price + store) — substring or fuzzy — which we show as a "matching
  // products" section AND use to surface stores that carry a match. null = no
  // active product search (query < 2 chars); an array = the product hits.
  const supabase = useMemo(() => createClient(), []);
  const [productResults, setProductResults] = useState<ProductHit[] | null>(
    null,
  );
  const [searching, setSearching] = useState(false);
  // Latest term this effect fired for, so a slow/out-of-order response that
  // resolves after the query changed is discarded instead of clobbering state.
  const latestTermRef = useRef("");

  // Stores that carry a matching product (derived from the product hits), so the
  // store list below can include them even when the store NAME doesn't match.
  const productMatchIds = useMemo(
    () =>
      productResults
        ? new Set(productResults.map((p) => p.store_id))
        : null,
    [productResults],
  );

  useEffect(() => {
    const term = query.trim();
    latestTermRef.current = term;
    // Store-name filtering below always runs; product search only kicks in at
    // 2+ chars (matches the RPC's own guard and avoids a full-catalog scan).
    if (term.length < 2) {
      setProductResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const handle = setTimeout(() => {
      void (async () => {
        const { data, error } = await supabase.rpc("search_products_fuzzy", {
          p_q: term,
        });
        // Ignore this response if the query moved on while it was in flight.
        if (latestTermRef.current !== term) return;
        setProductResults(error ? null : ((data ?? []) as ProductHit[]));
        setSearching(false);
      })();
    }, 250);
    return () => clearTimeout(handle);
  }, [query, supabase]);

  async function findNearMe() {
    setLocating(true);
    setGeoError(null);
    try {
      const loc = await getCurrentPosition();
      setUserLoc(loc);
      setSortMode("nearest");
    } catch {
      setGeoError(dict.explore.locationError);
    } finally {
      setLocating(false);
    }
  }

  // Picking "Nearest" requests location first if we don't have it yet; on
  // success findNearMe() flips the sort. Every other mode applies immediately.
  function selectSort(mode: SortMode) {
    if (mode === "nearest" && !userLoc) {
      void findNearMe();
      return;
    }
    setSortMode(mode);
  }

  const sortOptions: { key: SortMode; label: string; Icon: LucideIcon }[] = [
    { key: "recommended", label: dict.sort.recommended, Icon: Sparkles },
    { key: "nearest", label: dict.sort.nearest, Icon: Navigation },
    { key: "topRated", label: dict.sort.topRated, Icon: Star },
    { key: "newest", label: dict.sort.newest, Icon: Clock },
    { key: "openNow", label: dict.sort.openNow, Icon: DoorOpen },
  ];

  const filtered = stores.filter((s) => {
    if (category !== "all" && s.category !== category) return false;
    if (group !== "all" && categoryGroup[s.category] !== group) return false;
    if (region !== "all" && s.region !== region) return false;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      const nameMatch =
        s.name.ar.toLowerCase().includes(q) ||
        s.name.en.toLowerCase().includes(q);
      // Keep the store if its NAME matches (client-side, as before) OR one of
      // its PRODUCTS matched server-side via the RPC.
      const productMatch = productMatchIds?.has(s.id) ?? false;
      if (!nameMatch && !productMatch) return false;
    }
    return true;
  });

  // Annotate distance to the store's CLOSEST branch whenever the buyer has
  // shared their location, so the distance badge shows in every sort mode
  // (stores without coordinates get no distance).
  const withDistance = userLoc
    ? filtered.map((s) => ({
        ...s,
        distanceKm: nearestDistance(s, userLoc.lat, userLoc.lng),
      }))
    : filtered;

  // "Open now" is a filter; the rest keep the full scoped list.
  const scoped =
    sortMode === "openNow"
      ? withDistance.filter((s) => s.isOpen)
      : withDistance;

  // Sort is stable (Array.prototype.sort), so equal keys keep the incoming
  // featured-first / newest-first order. recommended/newest/openNow need no
  // re-sort — the server already delivered them in that order.
  const displayed = [...scoped];
  if (sortMode === "nearest") {
    displayed.sort(
      (a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity),
    );
  } else if (sortMode === "topRated") {
    displayed.sort(
      (a, b) =>
        (b.rating ?? -1) - (a.rating ?? -1) ||
        (b.reviews ?? 0) - (a.reviews ?? 0),
    );
  }

  return (
    <div className="pb-16">
      {/* Header band — the search is the centerpiece, like the homepage hero. */}
      <div className="relative overflow-hidden border-b border-border">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-primary-soft/60 via-background to-background"
        />
        <Container className="py-10 text-center sm:py-14">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
            {dict.explore.title}
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground sm:text-lg">
            {dict.explore.subtitle}
          </p>
          <div className="mx-auto mt-7 flex max-w-xl items-center gap-2.5 rounded-full border border-border bg-surface px-5 shadow-lg transition-all focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10">
            {searching ? (
              <Loader2 className="h-5 w-5 shrink-0 animate-spin text-muted-foreground" />
            ) : (
              <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
            )}
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={dict.explore.searchPlaceholder}
              className="w-full bg-transparent py-4 text-[15px] outline-none placeholder:text-muted-foreground"
            />
          </div>
        </Container>
      </div>

      <Container className="py-8">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              setGroup("all");
              setCategory("all");
            }}
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition-all ${chipClass(group === "all" && category === "all")}`}
          >
            {dict.explore.allCategories}
          </button>
          {groupKeys.map((g) => {
            const GIcon = groupIcons[g];
            return (
              <button
                key={g}
                onClick={() => {
                  setGroup(g);
                  setCategory("all");
                }}
                className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition-all ${chipClass(group === g)}`}
              >
                <GIcon className="h-4 w-4" />
                {dict.groups[g].name}
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => setRegion("all")}
            className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${chipClass(region === "all")}`}
          >
            {dict.explore.allRegions}
          </button>
          {regions.map((r) => (
            <button
              key={r.key}
              onClick={() => setRegion(r.key)}
              className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${chipClass(region === r.key)}`}
            >
              {r.name[lang]}
            </button>
          ))}
        </div>

        <div className="mt-5">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {dict.sort.label}
          </div>
          <div
            role="group"
            aria-label={dict.sort.label}
            className="flex flex-wrap gap-2"
          >
            {sortOptions.map(({ key, label, Icon }) => {
              const active = sortMode === key;
              const isLocating = key === "nearest" && locating;
              const ChipIcon = isLocating ? Loader2 : Icon;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => selectSort(key)}
                  disabled={isLocating}
                  aria-pressed={active}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors disabled:opacity-60 ${chipClass(active)}`}
                >
                  <ChipIcon
                    className={`h-3.5 w-3.5 ${isLocating ? "animate-spin" : ""}`}
                  />
                  {isLocating ? dict.explore.locating : label}
                </button>
              );
            })}
          </div>
          {geoError && (
            <p className="mt-2 text-sm font-medium text-danger">{geoError}</p>
          )}
        </div>

        {productResults && productResults.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-extrabold">
              <Package className="h-5 w-5 text-primary" />
              {dict.explore.matchingProducts}
              <span className="text-sm font-medium text-muted-foreground">
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

        <p className="mt-8 text-sm text-muted-foreground">
          {displayed.length} {dict.explore.results}
        </p>

        {displayed.length ? (
          <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {displayed.map((s) => (
              <StoreCard key={s.id} store={s} lang={lang} dict={dict} />
            ))}
          </div>
        ) : (
          <div className="mt-10 rounded-2xl border border-dashed border-border py-16 text-center text-muted-foreground">
            {dict.explore.empty}
          </div>
        )}
      </Container>
    </div>
  );
}
