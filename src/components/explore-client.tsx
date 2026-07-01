"use client";

import { useState } from "react";
import { Search, Navigation, Loader2 } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import {
  categoryKeys,
  regions,
  type CategoryKey,
  type RegionKey,
  type Store,
} from "@/lib/catalog";
import { distanceKm } from "@/lib/geo";
import { Container } from "@/components/ui/container";
import { StoreCard } from "@/components/store-card";

function chipClass(active: boolean) {
  return active
    ? "bg-primary text-primary-foreground border-primary"
    : "bg-surface text-foreground border-border hover:border-primary/40";
}

export function ExploreClient({
  lang,
  dict,
  stores,
  initialQuery,
  initialCategory = "all",
  initialRegion = "all",
}: {
  lang: Locale;
  dict: Dictionary;
  stores: Store[];
  initialQuery?: string;
  initialCategory?: CategoryKey | "all";
  initialRegion?: RegionKey | "all";
}) {
  const [category, setCategory] = useState<CategoryKey | "all">(initialCategory);
  const [region, setRegion] = useState<RegionKey | "all">(initialRegion);
  const [query, setQuery] = useState(initialQuery ?? "");
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  function findNearMe() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoError(dict.explore.locationError);
      return;
    }
    setLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        setGeoError(dict.explore.locationError);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  const filtered = stores.filter((s) => {
    if (category !== "all" && s.category !== category) return false;
    if (region !== "all" && s.region !== region) return false;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      if (
        !s.name.ar.toLowerCase().includes(q) &&
        !s.name.en.toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  // When the buyer shares their location, annotate distance and sort nearest
  // first (stores without coordinates fall to the end).
  const displayed = userLoc
    ? filtered
        .map((s) => ({
          ...s,
          distanceKm:
            s.lat != null && s.lng != null
              ? distanceKm(userLoc.lat, userLoc.lng, s.lat, s.lng)
              : undefined,
        }))
        .sort(
          (a, b) =>
            (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity),
        )
    : filtered;

  return (
    <div className="py-10">
      <Container>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          {dict.explore.title}
        </h1>
        <p className="mt-2 text-muted-foreground">{dict.explore.subtitle}</p>

        <div className="mt-6 flex items-center gap-2 rounded-xl border border-border bg-surface px-4 sm:max-w-md">
          <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={dict.explore.searchPlaceholder}
            className="w-full bg-transparent py-2.5 text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            onClick={() => setCategory("all")}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${chipClass(category === "all")}`}
          >
            {dict.explore.allCategories}
          </button>
          {categoryKeys.map((k) => (
            <button
              key={k}
              onClick={() => setCategory(k)}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${chipClass(category === k)}`}
            >
              {dict.catalog[k].name}
            </button>
          ))}
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

        <div className="mt-4">
          <button
            onClick={findNearMe}
            disabled={locating}
            className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60 ${
              userLoc
                ? "border-primary bg-primary-soft text-primary"
                : "border-border hover:border-primary hover:text-primary"
            }`}
          >
            {locating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Navigation className="h-4 w-4" />
            )}
            {locating ? dict.explore.locating : dict.explore.nearest}
          </button>
          {geoError && (
            <p className="mt-2 text-sm font-medium text-red-600">{geoError}</p>
          )}
        </div>

        <p className="mt-6 text-sm text-muted-foreground">
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
