import Link from "next/link";
import { MapPin } from "lucide-react";
import type { Locale } from "@/i18n/config";
import { regions, type RegionKey } from "@/lib/catalog";
import { getDiscoveryCoverage } from "@/lib/data/discovery";
import { facetIsUseful, regionOptions } from "@/lib/discovery";

// The location row on Home — and the honest version of it.
//
// §10 says to show a current location only when one is actually known. Nothing
// on this platform knows one: there is no region cookie, no region column on
// `profiles`, and the only durable customer region (`addresses.region`) is a
// delivery address, not a browsing preference — reading it here would be
// guessing that where you receive parcels is where you want to shop. The
// coordinates that /explore's "near me" collects live in React state and are
// never written anywhere. So this control asks; it does not claim.
//
// What it asks with is the marketplace's own census. `regionOptions` returns
// only the regions that have a live store behind them, with the count, on the
// same coverage read /explore's region facet uses — so every chip lands on
// results and the row cannot advertise a region the platform does not serve.
// Today that is exactly one region, which is why the "all regions" chip is
// gated on `facetIsUseful`: lib/discovery's own rule is that one surviving
// option is a label rather than a choice, and "All regions / North" would be a
// distinction with nothing on either side of it. The day a second region has a
// store, this becomes a real chooser with no code change.
//
// Phones only. Desktop's location control is the region select inside
// HeroSearch, which is above the fold at that width; two of them on one screen
// is the same question asked twice.
export async function HomeLocation({
  lang,
  labels,
}: {
  lang: Locale;
  labels: { byArea: string; allRegions: string };
}) {
  const options = regionOptions(await getDiscoveryCoverage());
  if (options.length === 0) return null;

  const regionName = (key: RegionKey) =>
    regions.find((r) => r.key === key)?.name[lang] ?? key;

  return (
    <nav
      aria-label={labels.byArea}
      // Bleeds past the Container gutter so a sixth chip is clipped rather than
      // wrapped — the same rail idiom the category row uses.
      className="-mx-5 flex items-center gap-2 overflow-x-auto px-5 text-start [scrollbar-width:none] sm:-mx-6 sm:px-6 [&::-webkit-scrollbar]:hidden"
    >
      <MapPin aria-hidden className="h-4 w-4 shrink-0 text-primary" />
      {facetIsUseful(options) && (
        <Link
          href={`/${lang}/explore`}
          className="inline-flex h-11 shrink-0 items-center rounded-full border border-border bg-surface px-3.5 text-sm font-semibold transition-colors hover:border-primary/40 hover:text-primary"
        >
          {labels.allRegions}
        </Link>
      )}
      {options.map((o) => (
        <Link
          key={o.key}
          href={`/${lang}/explore?region=${o.key}`}
          className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 text-sm font-semibold transition-colors hover:border-primary/40 hover:text-primary"
        >
          {regionName(o.key)}
          <span
            dir="ltr"
            className="text-xs font-bold tabular-nums text-muted-foreground"
          >
            {o.count}
          </span>
        </Link>
      ))}
    </nav>
  );
}
