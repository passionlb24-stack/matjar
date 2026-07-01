"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, SlidersHorizontal } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { regions as catalogRegions } from "@/lib/catalog";
import type {
  MarketCategory,
  MarketCity,
  MarketRegion,
} from "@/lib/data/market";

export type MarketFilterValues = {
  q: string;
  category: string;
  region: string;
  city: string;
  priceMin: string;
  priceMax: string;
  datePosted: string;
  sort: string;
};

const field =
  "rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary";

export function MarketFilters({
  lang,
  dict,
  categories,
  cities,
  regions,
  initial,
}: {
  lang: Locale;
  dict: Dictionary;
  categories: MarketCategory[];
  cities: MarketCity[];
  regions?: MarketRegion[];
  initial: MarketFilterValues;
}) {
  const regionList: MarketRegion[] =
    regions && regions.length
      ? regions
      : catalogRegions.map((r) => ({ key: r.key, name: r.name[lang] }));
  const router = useRouter();
  const t = dict.market;
  const [q, setQ] = useState(initial.q);
  const [category, setCategory] = useState(initial.category);
  const [region, setRegion] = useState(initial.region);
  const [city, setCity] = useState(initial.city);
  const [priceMin, setPriceMin] = useState(initial.priceMin);
  const [priceMax, setPriceMax] = useState(initial.priceMax);
  const [datePosted, setDatePosted] = useState(initial.datePosted);
  const [sort, setSort] = useState(initial.sort);

  function navigate(overrides: Partial<MarketFilterValues> = {}) {
    const s = { q, category, region, city, priceMin, priceMax, datePosted, sort, ...overrides };
    const p = new URLSearchParams();
    if (s.q.trim()) p.set("q", s.q.trim());
    if (s.category !== "all") p.set("category", s.category);
    if (s.region !== "all") p.set("region", s.region);
    if (s.city.trim()) p.set("city", s.city.trim());
    if (s.priceMin) p.set("min", s.priceMin);
    if (s.priceMax) p.set("max", s.priceMax);
    if (s.datePosted !== "any") p.set("date", s.datePosted);
    if (s.sort !== "newest") p.set("sort", s.sort);
    const qs = p.toString();
    router.push(`/${lang}/market${qs ? `?${qs}` : ""}`);
  }

  function chip(active: boolean) {
    return active
      ? "bg-primary text-primary-foreground border-primary"
      : "bg-surface text-foreground border-border hover:border-primary/40";
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          navigate();
        }}
        className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4"
      >
        <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t.search}
          className="w-full bg-transparent py-2.5 text-sm outline-none placeholder:text-muted-foreground"
        />
        <button type="submit" className="shrink-0 rounded-lg bg-primary px-4 py-1.5 text-sm font-bold text-primary-foreground">
          {t.search.replace("…", "")}
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => {
            setCategory("all");
            navigate({ category: "all" });
          }}
          className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${chip(category === "all")}`}
        >
          {t.allCategories}
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => {
              setCategory(c.slug);
              navigate({ category: c.slug });
            }}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${chip(category === c.slug)}`}
          >
            {c.name}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border bg-surface-muted/40 p-3">
        <SlidersHorizontal className="h-4 w-4 self-center text-muted-foreground" />
        <select value={region} onChange={(e) => setRegion(e.target.value)} className={field}>
          <option value="all">{t.allRegions}</option>
          {regionList.map((r) => (
            <option key={r.key} value={r.key}>
              {r.name}
            </option>
          ))}
        </select>
        <input value={city} onChange={(e) => setCity(e.target.value)} list="market-filter-cities" placeholder={t.city} className={`${field} w-28`} />
        <datalist id="market-filter-cities">
          {cities
            .filter((c) => region === "all" || c.region === region)
            .map((c) => (
              <option key={c.id} value={c.name} />
            ))}
        </datalist>
        <input value={priceMin} onChange={(e) => setPriceMin(e.target.value)} type="number" min="0" placeholder={t.priceMin} className={`${field} w-24`} />
        <input value={priceMax} onChange={(e) => setPriceMax(e.target.value)} type="number" min="0" placeholder={t.priceMax} className={`${field} w-24`} />
        <select value={datePosted} onChange={(e) => setDatePosted(e.target.value)} className={field}>
          <option value="any">{t.dateAny}</option>
          <option value="24h">{t.date24h}</option>
          <option value="7d">{t.date7d}</option>
          <option value="30d">{t.date30d}</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} className={field}>
          <option value="newest">{t.sortNewest}</option>
          <option value="oldest">{t.sortOldest}</option>
          <option value="cheapest">{t.sortCheapest}</option>
          <option value="expensive">{t.sortExpensive}</option>
        </select>
        <button onClick={() => navigate()} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
          {t.sort}
        </button>
      </div>
    </div>
  );
}
