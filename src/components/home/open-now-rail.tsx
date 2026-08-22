import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { getStoresForListing } from "@/lib/data/stores";
import { StoreRail } from "@/components/store-rail";
import { railOnlyIfEnough } from "@/lib/rail";
import { DEFAULT_QUERY, discoveryHref, withQuery } from "@/lib/discovery";

/** Same ceiling FeaturedStores uses — a phone rail nobody reaches the end of. */
const MAX = 8;

// "مفتوح هلق" — the stores a customer can act on right now.
//
// The rail is not a new query and not a new definition of "open". It reuses the
// listing every discovery surface already reads, and `Store.isOpen` as that
// listing computed it: `isOpenNow(parseHours(hours), now) ?? true` — hours are
// configured and the clock is inside them, OR the merchant has published no
// hours at all, in which case this platform's standing rule (lib/hours.ts) is
// to treat the store as open rather than turn a customer away over a field
// nobody filled in.
//
// That rule is inherited on purpose, not accepted by accident. The green
// «مفتوح» badge on every card in this rail is computed from the same boolean,
// and so is /explore's own "open now" filter — which is exactly where the
// "see all" link goes. A stricter definition here would put stores in the rail
// whose badge said one thing and the heading above them another, and would
// drop stores that /explore?open=1 then lists. One definition, three surfaces.
//
// The heading says "open now" and nothing else. It does NOT say "near you":
// nothing on this page knows where the customer is, only a minority of live
// stores carry coordinates, and nothing here sorts by distance — the same
// reason FeaturedStores refuses that phrase two sections below.
export async function OpenNowRail({
  lang,
  dict,
}: {
  lang: Locale;
  dict: Dictionary;
}) {
  const open = (await getStoresForListing())
    .filter((s) => s.isOpen)
    .slice(0, MAX);

  // Nothing open at this hour is a real answer, and an empty state that says so
  // is a section a customer has to scroll past at 3am. The rail simply is not
  // there; /explore still is.
  if (open.length === 0) return null;

  return (
    <StoreRail
      // Below three the row stands down on phones — a two-card horizontal
      // scroller promises "there is more" and breaks it in the same frame.
      className={railOnlyIfEnough(open.length)}
      stores={open}
      lang={lang}
      dict={dict}
      title={dict.home.openNow}
      // Built through discoveryHref rather than written by hand so the link and
      // parseDiscoveryQuery can never spell the same filter differently.
      href={discoveryHref(
        `/${lang}/explore`,
        withQuery(DEFAULT_QUERY, { openNow: true }),
      )}
      seeAll={dict.featured.viewAll}
    />
  );
}
