"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import {
  categoryKeys,
  regions,
  type CategoryKey,
  type RegionKey,
  type Store,
} from "@/lib/catalog";
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
}: {
  lang: Locale;
  dict: Dictionary;
  stores: Store[];
  initialQuery?: string;
}) {
  const [category, setCategory] = useState<CategoryKey | "all">("all");
  const [region, setRegion] = useState<RegionKey | "all">("all");
  const [query, setQuery] = useState(initialQuery ?? "");

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

        <p className="mt-6 text-sm text-muted-foreground">
          {filtered.length} {dict.explore.results}
        </p>

        {filtered.length ? (
          <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((s) => (
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
