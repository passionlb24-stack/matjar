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
  if (opts.area || opts.region) {
    data.address = {
      "@type": "PostalAddress",
      addressLocality: opts.area || undefined,
      addressRegion: opts.region || undefined,
      addressCountry: "LB",
    };
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
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data);
}
