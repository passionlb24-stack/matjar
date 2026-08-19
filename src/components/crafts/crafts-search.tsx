"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { tradeIcon } from "@/lib/trade-icons";
import type { Locale } from "@/i18n/config";
import type { AreaRef } from "@/lib/data/crafts";

type Suggestion = {
  slug: string;
  name_ar: string;
  name_en: string;
  icon: string | null;
};

// "What do you need?" and "where?" — the only two questions this section opens
// with.
//
// The suggestion list is the point. A customer types كهربجي, which is not the
// name of anything in the taxonomy, and search_trades resolves it through the
// trade's synonyms. Picking a suggestion navigates to that trade's page, so the
// customer lands on a real, indexable category rather than a result set built
// from whatever they happened to type.
export function CraftsSearch({
  lang,
  areasByRegion,
  labels,
}: {
  lang: Locale;
  areasByRegion: Record<string, AreaRef[]>;
  labels: {
    whatPlaceholder: string;
    wherePlaceholder: string;
    anywhere: string;
    search: string;
    noMatch: string;
  };
}) {
  const router = useRouter();
  const ar = lang === "ar";
  const [q, setQ] = useState("");
  const [area, setArea] = useState("");
  const [hits, setHits] = useState<Suggestion[] | null>(null);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Debounced so a fast typist does not fire a query per keystroke.
  //
  // The short-query case returns without touching state: clearing `hits` here
  // would be a synchronous setState inside an effect, which cascades a render.
  // Whether the list is worth showing is derived at render time instead, from
  // the same condition — so deleting back down to one letter hides stale
  // suggestions without a second pass.
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const timer = setTimeout(async () => {
      const { data } = await createClient().rpc("search_trades", {
        p_q: term,
        p_limit: 6,
      });
      setHits((data ?? []) as Suggestion[]);
      setOpen(true);
    }, 220);
    return () => clearTimeout(timer);
  }, [q]);

  // Close on an outside click, so the list never sits over the page content.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function go(tradeSlug?: string) {
    const params = new URLSearchParams();
    if (area) params.set("area", area);
    if (!tradeSlug && q.trim()) params.set("q", q.trim());
    const suffix = params.toString() ? `?${params}` : "";
    router.push(
      tradeSlug
        ? `/${lang}/crafts/${tradeSlug}${suffix}`
        : `/${lang}/crafts/all${suffix}`,
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        // Enter with exactly one suggestion means that one; otherwise free text.
        go(hits?.length === 1 ? hits[0].slug : undefined);
      }}
      className="flex flex-col gap-2 sm:flex-row"
    >
      <div ref={boxRef} className="relative flex-1">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4">
          <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => hits && setOpen(true)}
            placeholder={labels.whatPlaceholder}
            className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        {open && hits && q.trim().length >= 2 && (
          <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
            {hits.length ? (
              hits.map((h) => {
                const Icon = tradeIcon(h.slug);
                return (
                  <button
                    key={h.slug}
                    type="button"
                    onClick={() => go(h.slug)}
                    className="flex min-h-11 w-full items-center gap-2 px-4 py-2.5 text-start text-sm font-semibold transition-colors hover:bg-surface-muted"
                  >
                    <Icon aria-hidden className="h-4 w-4 shrink-0 text-primary" />
                    {ar ? h.name_ar : h.name_en}
                  </button>
                );
              })
            ) : (
              <p className="px-4 py-3 text-sm text-muted-foreground">
                {labels.noMatch}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 sm:w-56">
        <MapPin className="h-5 w-5 shrink-0 text-muted-foreground" />
        <select
          value={area}
          onChange={(e) => setArea(e.target.value)}
          aria-label={labels.wherePlaceholder}
          className="w-full bg-transparent py-3 text-sm outline-none"
        >
          <option value="">{labels.anywhere}</option>
          {Object.entries(areasByRegion).map(([region, areas]) => (
            <optgroup key={region} label={region}>
              {areas.map((a) => (
                <option key={a.slug} value={a.slug}>
                  {ar ? a.name_ar : a.name_en}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <button
        type="submit"
        className="rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
      >
        {labels.search}
      </button>
    </form>
  );
}
