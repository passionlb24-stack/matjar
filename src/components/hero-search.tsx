"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Search } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { regions } from "@/lib/catalog";

export function HeroSearch({
  lang,
  dict,
  popular,
}: {
  lang: Locale;
  dict: Dictionary;
  popular: string[];
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [region, setRegion] = useState("all");

  function go(term?: string) {
    const query = (term ?? q).trim();
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (region !== "all") params.set("region", region);
    const qs = params.toString();
    // A search term goes to the unified results page (stores + products +
    // listings); a bare region browse stays on explore.
    const dest = query ? "search" : "explore";
    router.push(`/${lang}/${dest}${qs ? `?${qs}` : ""}`);
  }

  return (
    <div className="mx-auto mt-8 max-w-2xl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          go();
        }}
        className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-2 shadow-sm sm:flex-row sm:items-center sm:gap-0 sm:rounded-full"
      >
        <div className="flex items-center gap-2 px-3 text-sm sm:border-e sm:border-border">
          <MapPin className="h-4 w-4 shrink-0 text-primary" />
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            aria-label={dict.hero.locationAll}
            className="cursor-pointer whitespace-nowrap bg-transparent py-2.5 font-semibold outline-none"
          >
            <option value="all">{dict.hero.locationAll}</option>
            {regions.map((r) => (
              <option key={r.key} value={r.key}>
                {r.name[lang]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-1 items-center gap-2 px-3">
          <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={dict.hero.searchPlaceholder}
            className="w-full bg-transparent py-2.5 text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <button
          type="submit"
          className="rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover sm:rounded-full"
        >
          {dict.hero.searchButton}
        </button>
      </form>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm">
        <span className="text-muted-foreground">{dict.hero.popular}:</span>
        {popular.map((p) => (
          <button
            key={p}
            onClick={() => go(p)}
            className="rounded-full border border-border bg-surface px-3 py-1 font-medium transition-colors hover:border-primary hover:text-primary"
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
