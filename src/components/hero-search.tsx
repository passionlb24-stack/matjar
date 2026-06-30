"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, MapPin, Search } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";

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

  function go(term?: string) {
    const query = (term ?? q).trim();
    router.push(
      `/${lang}/explore${query ? `?q=${encodeURIComponent(query)}` : ""}`,
    );
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
          <MapPin className="h-4 w-4 text-primary" />
          <span className="whitespace-nowrap font-semibold">
            {dict.hero.locationAll}
          </span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
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
