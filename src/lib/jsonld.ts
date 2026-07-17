// Structured-data (schema.org JSON-LD) builders. Injected as <script> tags on
// the store and product pages so Google can render rich results (business
// cards, product price/rating snippets). Pure functions — no imports.

type Nullable<T> = T | null | undefined;

export function storeJsonLd(opts: {
  name: string;
  description?: Nullable<string>;
  image?: Nullable<string>;
  url: string;
  telephone?: Nullable<string>;
  area?: Nullable<string>;
  region?: Nullable<string>;
  rating?: Nullable<number>;
  reviewCount?: Nullable<number>;
  lat?: Nullable<number>;
  lng?: Nullable<number>;
  priceRange?: Nullable<string>;
  /** schema.org OpeningHoursSpecification entries, pre-built by the caller. */
  openingHours?: {
    days: string[];
    opens: string;
    closes: string;
  }[];
}) {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: opts.name,
    url: opts.url,
  };
  if (opts.description) data.description = opts.description;
  if (opts.image) data.image = opts.image;
  if (opts.telephone) data.telephone = opts.telephone;
  if (opts.priceRange) data.priceRange = opts.priceRange;
  if (opts.area || opts.region) {
    data.address = {
      "@type": "PostalAddress",
      addressLocality: opts.area || undefined,
      addressRegion: opts.region || undefined,
      addressCountry: "LB",
    };
  }
  if (opts.lat != null && opts.lng != null) {
    data.geo = {
      "@type": "GeoCoordinates",
      latitude: opts.lat,
      longitude: opts.lng,
    };
  }
  if (opts.openingHours?.length) {
    data.openingHoursSpecification = opts.openingHours.map((h) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: h.days,
      opens: h.opens,
      closes: h.closes,
    }));
  }
  if (opts.rating && opts.reviewCount) {
    data.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: Number(opts.rating.toFixed(1)),
      reviewCount: opts.reviewCount,
      bestRating: 5,
    };
  }
  return data;
}

/** Maps the app's WeekHours (0=Sun..6=Sat → {open,close}) to schema.org
 *  OpeningHoursSpecification day names. Kept here so jsonld stays import-free. */
export function toOpeningHours(
  hours: Nullable<Record<string, { open: string; close: string }>>,
): { days: string[]; opens: string; closes: string }[] {
  if (!hours) return [];
  const NAMES = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const out: { days: string[]; opens: string; closes: string }[] = [];
  for (let d = 0; d < 7; d++) {
    const h = hours[String(d)];
    if (h?.open && h?.close) {
      out.push({ days: [NAMES[d]], opens: h.open, closes: h.close });
    }
  }
  return out;
}

export function productJsonLd(opts: {
  name: string;
  description?: Nullable<string>;
  image?: Nullable<string>;
  url: string;
  price: number;
  storeName?: Nullable<string>;
  available?: boolean;
  rating?: Nullable<number>;
  reviewCount?: Nullable<number>;
}) {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: opts.name,
    url: opts.url,
    offers: {
      "@type": "Offer",
      price: opts.price,
      priceCurrency: "USD",
      availability:
        opts.available === false
          ? "https://schema.org/OutOfStock"
          : "https://schema.org/InStock",
      url: opts.url,
    },
  };
  if (opts.description) data.description = opts.description;
  if (opts.image) data.image = opts.image;
  if (opts.storeName) data.brand = { "@type": "Brand", name: opts.storeName };
  if (opts.rating && opts.reviewCount) {
    data.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: Number(opts.rating.toFixed(1)),
      reviewCount: opts.reviewCount,
      bestRating: 5,
    };
  }
  return data;
}

/** Renders a JSON-LD object as the inner text for a <script type="application/ld+json">. */
// Homepage brand graph: Organization (logo + social profiles) and WebSite with
// a SearchAction (makes Google eligible to show the sitelinks search box).
export function siteJsonLd(opts: {
  siteUrl: string;
  lang: string;
  name: string;
  description: string;
}) {
  return [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: opts.name,
      url: opts.siteUrl,
      logo: `${opts.siteUrl}/logo.png`,
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: opts.name,
      url: opts.siteUrl,
      description: opts.description,
      inLanguage: opts.lang,
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${opts.siteUrl}/${opts.lang}/search?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
  ];
}

export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data);
}
