import { describe, it, expect } from "vitest";
import { storeJsonLd, productJsonLd, jsonLdScript } from "@/lib/jsonld";

describe("storeJsonLd", () => {
  it("emits a LocalBusiness with address and rating when provided", () => {
    const d = storeJsonLd({
      name: "Nazih Home",
      url: "https://matjarlb.com/ar/store/1",
      description: "Furniture",
      image: "https://x/logo.png",
      telephone: "+96170000000",
      area: "Achrafieh",
      rating: 4.6667,
      reviewCount: 3,
    }) as Record<string, unknown>;
    expect(d["@type"]).toBe("LocalBusiness");
    expect(d.name).toBe("Nazih Home");
    expect((d.aggregateRating as Record<string, unknown>).ratingValue).toBe(4.7);
    expect((d.address as Record<string, unknown>).addressCountry).toBe("LB");
  });

  it("omits aggregateRating when there are no reviews", () => {
    const d = storeJsonLd({
      name: "S",
      url: "u",
      rating: null,
      reviewCount: 0,
    }) as Record<string, unknown>;
    expect(d.aggregateRating).toBeUndefined();
  });
});

describe("productJsonLd", () => {
  it("marks in/out of stock via the offer availability", () => {
    const inStock = productJsonLd({ name: "P", url: "u", price: 10 }) as {
      offers: { availability: string; priceCurrency: string };
    };
    expect(inStock.offers.availability).toBe("https://schema.org/InStock");
    expect(inStock.offers.priceCurrency).toBe("USD");

    const out = productJsonLd({
      name: "P",
      url: "u",
      price: 10,
      available: false,
    }) as { offers: { availability: string } };
    expect(out.offers.availability).toBe("https://schema.org/OutOfStock");
  });
});

describe("jsonLdScript", () => {
  it("serializes to a JSON string", () => {
    expect(jsonLdScript({ a: 1 })).toBe('{"a":1}');
  });
});
