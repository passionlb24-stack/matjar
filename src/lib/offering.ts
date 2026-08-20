import type { CategoryKey } from "./catalog";
import type { FeatureModuleKey } from "./modules-catalog";
import { resolveStoreModules } from "./sectors";
import { isDirectoryOnlySector } from "./store-experience";

// ===== Offering Experience Resolver =====
//
// Every row of `products` used to render as a Product. A dental cleaning was
// given a stock badge, "منتجات مشابهة" and "تقييمات المنتج"; a restaurant dish
// behaved like a retail SKU with a delivery promise. The table is shared by
// three declared kinds (`products.item_kind` ∈ product | service | digital) and
// seventeen sectors, and the detail page read none of that — it branched once,
// on `item_kind === 'service' || sector is not a commerce sector`, and rendered
// one hardcoded JSX sequence for everything else.
//
// This is the sibling of `resolveProfileOrder` in sectors.ts, for the OFFERING
// rather than the store: given a store category and the offering's own kind it
// returns the page variant, the primary CTA, and the ordered sections. It is a
// pure function (no I/O, no dictionary) so it is unit-testable and can be reused
// by any surface that has to speak about one offering.

/** `products.item_kind` — the three kinds an offering row may declare. */
export type OfferingKind = "product" | "service" | "digital";

/** The page shape. Three, deliberately: goods, appointments, menu items. */
export type OfferingVariant =
  | "physicalProduct"
  | "appointmentService"
  | "menuItem";

/** The primary action. Not a function of the variant alone: a physical good in
 *  a directory-only sector (a car, a flat) must not reach a cart. */
export type OfferingCtaKey =
  | "addToCart"
  | "addToOrder"
  | "bookAppointment"
  | "contactStore";

/** Which noun the whole page speaks in — indexes `dict.offering.<noun>.*`.
 *  This is what stops a clinic page saying "تقييمات المنتج". */
export type OfferingNoun = "product" | "service" | "dish";

export type OfferingSectionKey =
  | "gallery"
  | "header"
  | "price"
  | "duration"
  | "stock"
  | "included"
  | "description"
  | "provider"
  | "buyBox"
  | "share"
  | "policies"
  | "boughtTogether"
  | "reviews"
  | "qa"
  | "moreFromStore"
  | "related"
  | "recentlyViewed";

/** Exactly the order the page rendered before this existed (plus the two
 *  sections that had no home: `duration`, which was buried inside the booking
 *  box, and `provider`, which did not exist at all). Any variant that omits a
 *  key without DECLARING the omission gets it appended in this order. */
export const DEFAULT_OFFERING_SECTIONS: OfferingSectionKey[] = [
  "gallery",
  "header",
  "price",
  "duration",
  "stock",
  "included",
  "description",
  "provider",
  "buyBox",
  "share",
  "policies",
  "boughtTogether",
  "reviews",
  "qa",
  "moreFromStore",
  "related",
  "recentlyViewed",
];

/** Where a section renders. The page is a two-column hero plus a stack of
 *  full-width blocks; the resolver orders within each region rather than
 *  pretending the page is one flat list. */
export type OfferingSlot = "gallery" | "detail" | "page";

const DETAIL_SECTIONS: ReadonlySet<OfferingSectionKey> = new Set([
  "header",
  "price",
  "duration",
  "stock",
  "included",
  "description",
  "provider",
  "buyBox",
  "share",
  "policies",
]);

export function offeringSectionSlot(key: OfferingSectionKey): OfferingSlot {
  if (key === "gallery") return "gallery";
  return DETAIL_SECTIONS.has(key) ? "detail" : "page";
}

export type OfferingExperience = {
  variant: OfferingVariant;
  cta: OfferingCtaKey;
  noun: OfferingNoun;
  /** Ordered sections to render. Never contains a key twice. */
  sections: OfferingSectionKey[];
  /** Sections this variant DECLARES inapplicable. `sections` ∪ `omitted` is
   *  always the full key set — a section can be withheld on purpose, never by
   *  the accident of somebody forgetting to list it. */
  omitted: OfferingSectionKey[];
  /** The kind that "related"/"more from store" lists must be filtered to, so a
   *  clinic never recommends a t-shirt under "خدمات مشابهة" (and a retail page
   *  never lists a service under "منتجات مشابهة"). */
  relatedKind: OfferingKind;
  /** The buy box transacts on this page (cart/order). False when the offering
   *  routes into the booking engine or is directory-only. */
  transacts: boolean;
};

type Composition = {
  sections?: OfferingSectionKey[];
  omit?: OfferingSectionKey[];
};

const COMPOSITION: Record<OfferingVariant, Composition> = {
  // Today's page, unchanged in order. A good has no duration and no roster of
  // people who deliver it.
  physicalProduct: {
    omit: ["duration", "provider"],
  },
  // You choose a service by what it is, how long it takes and who performs it —
  // then you book. Stock is meaningless for an appointment, and "يُشترى عادةً
  // مع" is retail language that has no business on a dental cleaning.
  appointmentService: {
    sections: [
      "gallery",
      "header",
      "price",
      "duration",
      "description",
      "included",
      "provider",
      "buyBox",
      "policies",
      "share",
      "reviews",
      "qa",
      "related",
      "moreFromStore",
      "recentlyViewed",
    ],
    omit: ["stock", "boughtTogether"],
  },
  // A dish is picture, description, price, then the options you must answer
  // before it can be cooked. Nobody reads a spec sheet for a shawarma.
  menuItem: {
    sections: [
      "gallery",
      "header",
      "price",
      "stock",
      "description",
      "included",
      "buyBox",
      "share",
      "policies",
      "boughtTogether",
      "reviews",
      "qa",
      "related",
      "moreFromStore",
      "recentlyViewed",
    ],
    omit: ["duration", "provider"],
  },
};

const NOUN: Record<OfferingVariant, OfferingNoun> = {
  physicalProduct: "product",
  appointmentService: "service",
  menuItem: "dish",
};

const RELATED_KIND: Record<OfferingVariant, OfferingKind> = {
  physicalProduct: "product",
  appointmentService: "service",
  menuItem: "product",
};

/** The page shape for an offering. */
export function offeringVariant(args: {
  category: CategoryKey;
  itemKind: OfferingKind;
}): OfferingVariant {
  // The kind wins over the sector: a clinic that sells supplements sells a
  // product, and a butcher that offers home cutting offers a service.
  if (args.itemKind === "service") return "appointmentService";
  if (args.category === "food") return "menuItem";
  return "physicalProduct";
}

/** The primary CTA for an offering.
 *
 *  A physical good in a directory-only sector (real estate, car sales — sectors
 *  whose transaction engine is not built, see store-experience.ts) never reaches
 *  a cart: it hands the customer to the store. Everything else transacts through
 *  the path its variant already owns — the cart for goods and dishes, the
 *  booking engine for services. No new transaction path is introduced here.
 *
 *  …and a booking is only offered where a booking can actually happen. The
 *  item-kind toggle is shown in EVERY sector on purpose (a boutique doing
 *  alterations, a phone shop doing repairs, a pharmacy that is really a lab),
 *  but the storefront's booking engine renders only when the `appointments`
 *  module is on — `resolveStoreExperience` derives `showBooking` from the
 *  module set, never from the slug. Those two disagreed: a service row in a
 *  sector without `appointments` was given "احجز موعدًا" pointing at
 *  `/store/<id>?service=<id>`, and the page it landed on had no calendar on it.
 *  That is live today for the `services` sector, whose bundle carries `requests`
 *  and not `appointments`. Where there is no engine the honest CTA is the one
 *  the directory-only sectors already use: go to the store and get in touch. */
export function offeringCta(args: {
  category: CategoryKey;
  itemKind: OfferingKind;
  /** The store's RESOLVED module set, when the caller has one. Omitted, the
   *  sector's default bundle is used — which is also the full set of modules a
   *  store in that sector can currently switch on (the modules screen offers
   *  `sectorDefaultModules` and nothing else), so the sector default is the
   *  right answer, not merely the available one. */
  enabledModules?: ReadonlySet<FeatureModuleKey>;
}): OfferingCtaKey {
  // Directory-only first: those sectors have no engine at all, so not even a
  // service row may promise a booking there.
  if (isDirectoryOnlySector(args.category)) return "contactStore";
  const variant = offeringVariant(args);
  if (variant === "appointmentService") {
    const modules = args.enabledModules ?? resolveStoreModules(args.category);
    return modules.has("appointments") ? "bookAppointment" : "contactStore";
  }
  return variant === "menuItem" ? "addToOrder" : "addToCart";
}

/** Resolve the whole offering-detail experience.
 *
 *  Any section a composition forgets to list is APPENDED in default order
 *  rather than dropped — the same guarantee `resolveProfileOrder` gives the
 *  store profile, and for the same reason: a hand-written ordering is exactly
 *  the kind of list somebody edits in a hurry, and a page silently losing its
 *  reviews is invisible until a merchant complains. A section that genuinely
 *  does not belong must be declared in `omit`, which is visible in the tests. */
export function resolveOffering(args: {
  category: CategoryKey;
  itemKind: OfferingKind;
  /** See `offeringCta` — the store's resolved modules when the caller has
   *  them, the sector's default bundle otherwise. */
  enabledModules?: ReadonlySet<FeatureModuleKey>;
}): OfferingExperience {
  const variant = offeringVariant(args);
  const { sections: chosen, omit = [] } = COMPOSITION[variant];
  const omitted = new Set<OfferingSectionKey>(omit);
  const base = DEFAULT_OFFERING_SECTIONS.filter((k) => !omitted.has(k));
  let sections: OfferingSectionKey[];
  if (!chosen) {
    sections = base;
  } else {
    const listed = new Set(chosen);
    sections = [...chosen, ...base.filter((k) => !listed.has(k))];
  }
  return {
    variant,
    cta: offeringCta(args),
    noun: NOUN[variant],
    sections,
    omitted: DEFAULT_OFFERING_SECTIONS.filter((k) => omitted.has(k)),
    relatedKind: RELATED_KIND[variant],
    transacts:
      variant !== "appointmentService" && !isDirectoryOnlySector(args.category),
  };
}
