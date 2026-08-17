import {
  categoryKeys,
  categoryGroup,
  groupKeys,
  regions,
  type CategoryKey,
  type GroupKey,
  type RegionKey,
} from "./catalog";

// ===== Matjar Discovery — sector search & filter registry =====
//
// The sector registry (sectors.ts) says what a business IS: which OS modules it
// runs, how its public profile is ordered, what it calls its customers. This
// file is the same idea pointed at the other side of the marketplace — what a
// BUYER may search and filter by, per sector. A clinic is not found the way a
// grocery is: you look for a specialty, not a shelf.
//
// The rule that shapes every function below:
//
//   A filter is only offered when the data can back it.
//
// This is not a nicety. Matjar today has thirteen active stores in one region.
// Twelve of its seventeen sectors have no store at all. A "Bekaa" chip, a
// "Verified only" toggle, an "Automotive" tab — every one of them is a control
// that can only ever produce an empty screen, and a screen that empties itself
// whatever you press does not read as "no results", it reads as broken. The
// declarations here are therefore INTENT; what actually renders is the
// intersection of that intent with live counts (DiscoveryCoverage).
//
// The rule has a second, less obvious half. A filter that EVERY store passes
// narrows nothing — "accepts delivery" when all thirteen accept delivery is a
// button that reloads the same page. It is as broken as the empty one, in the
// opposite direction, so `partition` filters must match some-but-not-all.

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/** A field a buyer's words may be matched against. */
export type SearchFieldKey =
  | "storeName"
  | "storeDescription"
  /** Catalogue rows: products, services, dishes, listings — whatever the sector
   *  sells, they are all rows of the same table. */
  | "catalogItem"
  /** Merchant-defined groupings: aisles, menu sections, departments. */
  | "sectionName"
  /** Free-text practice description (clinics, lawyers, accountants). */
  | "specialties"
  /** Named humans a buyer might search for by name: doctors, practitioners. */
  | "providerName";

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

/** A control offered beside the results. */
export type FilterKey =
  /** Multi-option facets — see facetOptions(). */
  | "group"
  | "sector"
  | "region"
  /** Booleans. */
  | "openNow"
  | "hasCatalog"
  | "hasOffers"
  | "rated"
  | "verified"
  | "registered";

export const FACET_FILTERS = ["group", "sector", "region"] as const;
export type FacetFilterKey = (typeof FACET_FILTERS)[number];
export type BooleanFilterKey = Exclude<FilterKey, FacetFilterKey>;

export function isFacetFilter(key: FilterKey): key is FacetFilterKey {
  return (FACET_FILTERS as readonly string[]).includes(key);
}

// ---------------------------------------------------------------------------
// Coverage — what the platform actually holds, counted from live rows
// ---------------------------------------------------------------------------

/** Live store counts. Every field except the facet maps is a count of stores
 *  out of `total`, so `count === total` means "everyone" and `0` means "no one".
 *  Produced by src/lib/data/discovery.ts; hand-built in tests. */
export type DiscoveryCoverage = {
  total: number;
  bySector: Partial<Record<CategoryKey, number>>;
  byGroup: Partial<Record<GroupKey, number>>;
  byRegion: Partial<Record<RegionKey, number>>;
  /** Stores publishing structured opening hours. */
  withHours: number;
  /** Stores with at least one active catalogue row. */
  withCatalog: number;
  /** Stores with at least one discounted / in-offer catalogue row. */
  withOffers: number;
  /** Stores carrying at least one review. */
  rated: number;
  verified: number;
  registered: number;
  withDescription: number;
  withSpecialties: number;
  withProviders: number;
  withSections: number;
};

export const EMPTY_COVERAGE: DiscoveryCoverage = {
  total: 0,
  bySector: {},
  byGroup: {},
  byRegion: {},
  withHours: 0,
  withCatalog: 0,
  withOffers: 0,
  rated: 0,
  verified: 0,
  registered: 0,
  withDescription: 0,
  withSpecialties: 0,
  withProviders: 0,
  withSections: 0,
};

/**
 * Why a control is or is not shown.
 *  - `offer`     — it can return a narrower, non-empty result set.
 *  - `empty`     — nothing backs it; pressing it guarantees an empty screen.
 *  - `universal` — everything backs it; pressing it changes nothing.
 */
export type FilterAvailability = "offer" | "empty" | "universal";

/** How a filter's backing number should be read. */
type Backing = {
  count: (c: DiscoveryCoverage) => number;
  /**
   *  - `partition`: the number IS the match count, so some-but-not-all is
   *    required — a filter everyone passes is a no-op control.
   *  - `coverage`: the number only says the DATA EXISTS; what matches varies
   *    per request. "Open now" is the case: eleven stores publish hours, but how
   *    many are open depends on the hour, and a control that disappears at 3am
   *    and returns at 9am is worse than one that sometimes finds nothing.
   */
  mode: "partition" | "coverage";
};

const BOOLEAN_BACKING: Record<BooleanFilterKey, Backing> = {
  openNow: { count: (c) => c.withHours, mode: "coverage" },
  hasCatalog: { count: (c) => c.withCatalog, mode: "partition" },
  hasOffers: { count: (c) => c.withOffers, mode: "partition" },
  rated: { count: (c) => c.rated, mode: "partition" },
  verified: { count: (c) => c.verified, mode: "partition" },
  registered: { count: (c) => c.registered, mode: "partition" },
};

/** Whether a boolean filter has earned its place at the current inventory. */
export function filterAvailability(
  key: BooleanFilterKey,
  coverage: DiscoveryCoverage,
): FilterAvailability {
  const { count, mode } = BOOLEAN_BACKING[key];
  const n = count(coverage);
  if (n <= 0) return "empty";
  if (mode === "partition" && coverage.total > 0 && n >= coverage.total)
    return "universal";
  return "offer";
}

// ---------------------------------------------------------------------------
// Facets — a multi-option control is only worth showing if it offers a choice
// ---------------------------------------------------------------------------

export type FacetOption<K extends string> = { key: K; count: number };

/** Options that have at least one store behind them, in registry order. */
export function facetOptions<K extends string>(
  counts: Partial<Record<K, number>>,
  order: readonly K[],
): FacetOption<K>[] {
  return order
    .map((key) => ({ key, count: counts[key] ?? 0 }))
    .filter((o) => o.count > 0);
}

/** One surviving option is not a choice, it is a label. Two is the floor. */
export const MIN_FACET_OPTIONS = 2;

export function facetIsUseful<K extends string>(
  options: FacetOption<K>[],
): boolean {
  return options.length >= MIN_FACET_OPTIONS;
}

export const sectorOptions = (c: DiscoveryCoverage) =>
  facetOptions(c.bySector, categoryKeys);
export const groupOptions = (c: DiscoveryCoverage) =>
  facetOptions(c.byGroup, groupKeys);
export const regionOptions = (c: DiscoveryCoverage) =>
  facetOptions(
    c.byRegion,
    regions.map((r) => r.key),
  );

// ---------------------------------------------------------------------------
// The registry
// ---------------------------------------------------------------------------

/** What this sector's catalogue rows are CALLED. The same products table backs
 *  a grocery's shelves, a clinic's services and a restaurant's menu; only the
 *  word on the card changes. dict.discovery.nouns.* */
export type CatalogNoun =
  | "products"
  | "services"
  | "menu"
  | "listings"
  | "classes"
  | "courses"
  | "units"
  | "tickets";

export type SectorDiscovery = {
  /** Fields worth matching a buyer's words against, most specific first. */
  search: SearchFieldKey[];
  /** Filters this sector would offer IF the data backed them. */
  filters: FilterKey[];
  /** Vocabulary for catalogue counts on a result card. */
  catalogNoun: CatalogNoun;
};

// Every sector is found by name, in a place, at a time — that much is universal.
const BASE_SEARCH: SearchFieldKey[] = ["storeName", "storeDescription"];
const BASE_FILTERS: FilterKey[] = [
  "group",
  "sector",
  "region",
  "openNow",
  "rated",
];

/** Sectors you shop: the catalogue is the thing, so it is searchable and its
 *  presence and its discounts are worth filtering on. */
const shopSearch: SearchFieldKey[] = [
  ...BASE_SEARCH,
  "catalogItem",
  "sectionName",
];
const shopFilters: FilterKey[] = [...BASE_FILTERS, "hasCatalog", "hasOffers"];

/** Sectors you entrust: you are buying judgement, so credentials matter more
 *  than a price list, and the practice description is the real search field. */
const trustSearch: SearchFieldKey[] = [
  ...BASE_SEARCH,
  "specialties",
  "providerName",
  "catalogItem",
];
const trustFilters: FilterKey[] = [
  ...BASE_FILTERS,
  "verified",
  "registered",
  "hasCatalog",
];

export const sectorDiscovery: Record<CategoryKey, SectorDiscovery> = {
  retail: { search: shopSearch, filters: shopFilters, catalogNoun: "products" },
  farm: { search: shopSearch, filters: shopFilters, catalogNoun: "products" },
  pharmacy: {
    search: [...shopSearch, "specialties"],
    filters: [...shopFilters, "verified", "registered"],
    catalogNoun: "products",
  },
  food: {
    search: shopSearch,
    filters: shopFilters,
    catalogNoun: "menu",
  },
  healthcare: {
    search: trustSearch,
    filters: trustFilters,
    catalogNoun: "services",
  },
  professional: {
    search: trustSearch,
    filters: trustFilters,
    catalogNoun: "services",
  },
  contractors: {
    search: trustSearch,
    filters: trustFilters,
    catalogNoun: "services",
  },
  services: {
    search: [...BASE_SEARCH, "specialties", "catalogItem"],
    filters: [...BASE_FILTERS, "verified", "hasCatalog"],
    catalogNoun: "services",
  },
  beauty: {
    search: [...BASE_SEARCH, "catalogItem", "providerName"],
    filters: [...BASE_FILTERS, "hasCatalog", "hasOffers"],
    catalogNoun: "services",
  },
  petCare: {
    search: [...BASE_SEARCH, "catalogItem", "providerName"],
    filters: [...BASE_FILTERS, "hasCatalog"],
    catalogNoun: "services",
  },
  fitness: {
    search: [...BASE_SEARCH, "catalogItem", "providerName"],
    filters: [...BASE_FILTERS, "hasCatalog"],
    catalogNoun: "classes",
  },
  sportsCourts: {
    search: [...BASE_SEARCH, "catalogItem"],
    filters: [...BASE_FILTERS, "hasCatalog"],
    catalogNoun: "classes",
  },
  education: {
    search: [...BASE_SEARCH, "catalogItem", "providerName"],
    filters: [...BASE_FILTERS, "verified", "hasCatalog"],
    catalogNoun: "courses",
  },
  hospitality: {
    search: [...BASE_SEARCH, "catalogItem"],
    filters: [...BASE_FILTERS, "hasCatalog"],
    catalogNoun: "units",
  },
  events: {
    search: [...BASE_SEARCH, "catalogItem"],
    filters: [...BASE_FILTERS, "hasCatalog"],
    catalogNoun: "tickets",
  },
  realEstate: {
    search: [...BASE_SEARCH, "catalogItem"],
    filters: [...BASE_FILTERS, "hasCatalog", "registered"],
    catalogNoun: "listings",
  },
  automotive: {
    search: [...BASE_SEARCH, "catalogItem"],
    filters: [...BASE_FILTERS, "hasCatalog", "hasOffers"],
    catalogNoun: "listings",
  },
};

export function catalogNoun(category: CategoryKey): CatalogNoun {
  return sectorDiscovery[category].catalogNoun;
}

// ---------------------------------------------------------------------------
// Resolution — intent ∩ live data
// ---------------------------------------------------------------------------

/** The sectors a page is looking at. `null` means "the whole marketplace", which
 *  resolves to the sectors that actually have a store — so the twelve empty ones
 *  can never contribute a filter to /explore. */
export function scopeSectors(
  scope: CategoryKey[] | null,
  coverage: DiscoveryCoverage,
): CategoryKey[] {
  if (scope && scope.length) return scope;
  return categoryKeys.filter((c) => (coverage.bySector[c] ?? 0) > 0);
}

const FILTER_ORDER: FilterKey[] = [
  "group",
  "sector",
  "region",
  "openNow",
  "hasOffers",
  "hasCatalog",
  "rated",
  "verified",
  "registered",
];

/**
 * The filters a page may actually render.
 *
 * Union of what the in-scope sectors ask for, minus everything the live counts
 * cannot support. A facet survives only if it still offers a real choice; a
 * boolean survives only if it can both find something and exclude something.
 * When a single sector is in scope, the sector facet is dropped — you are
 * already inside it — and so is the group facet above it.
 */
export function resolveFilters(
  scope: CategoryKey[] | null,
  coverage: DiscoveryCoverage,
): FilterKey[] {
  const sectors = scopeSectors(scope, coverage);
  const wanted = new Set<FilterKey>();
  for (const s of sectors) for (const f of sectorDiscovery[s].filters) wanted.add(f);

  const pinned = scope != null && scope.length === 1;

  // A category page for a sector with no merchant yet: every filter on it, of
  // any kind, can only ever return nothing. The page still exists — somebody
  // followed a link to it — but it says so plainly instead of offering six
  // controls that all lead to the same empty screen.
  if (scope != null && !scope.some((s) => (coverage.bySector[s] ?? 0) > 0))
    return [];

  return FILTER_ORDER.filter((key) => {
    if (!wanted.has(key)) return false;
    if (key === "sector") {
      if (pinned) return false;
      return facetIsUseful(sectorOptions(coverage));
    }
    if (key === "group") {
      if (pinned) return false;
      return facetIsUseful(groupOptions(coverage));
    }
    if (key === "region") return facetIsUseful(regionOptions(coverage));
    return filterAvailability(key, coverage) === "offer";
  });
}

const SEARCH_BACKING: Record<SearchFieldKey, (c: DiscoveryCoverage) => number> = {
  // A store always has a name; matching it needs no other row to exist.
  storeName: (c) => c.total,
  storeDescription: (c) => c.withDescription,
  catalogItem: (c) => c.withCatalog,
  sectionName: (c) => c.withSections,
  specialties: (c) => c.withSpecialties,
  providerName: (c) => c.withProviders,
};

/**
 * The fields a search may actually be matched against.
 *
 * Unlike filters these are `coverage`-only: a field every store fills is still
 * a good field to search — matching a name that everyone has still discriminates
 * between them, whereas a filter everyone passes does not. What is excluded is
 * the field NO store fills, which would otherwise be a silent, permanent miss.
 */
export function resolveSearchFields(
  scope: CategoryKey[] | null,
  coverage: DiscoveryCoverage,
): SearchFieldKey[] {
  const sectors = scopeSectors(scope, coverage);
  const wanted = new Set<SearchFieldKey>();
  for (const s of sectors) for (const f of sectorDiscovery[s].search) wanted.add(f);
  const order: SearchFieldKey[] = [
    "storeName",
    "storeDescription",
    "catalogItem",
    "sectionName",
    "specialties",
    "providerName",
  ];
  return order.filter((k) => wanted.has(k) && SEARCH_BACKING[k](coverage) > 0);
}

/** The sectors of a group that actually have a store. Drives the sibling links
 *  on a category page — a group whose other sectors are all empty gets none. */
export function siblingSectors(
  category: CategoryKey,
  coverage: DiscoveryCoverage,
): CategoryKey[] {
  const group = categoryGroup[category];
  return categoryKeys.filter(
    (c) =>
      c !== category &&
      categoryGroup[c] === group &&
      (coverage.bySector[c] ?? 0) > 0,
  );
}

// ---------------------------------------------------------------------------
// Result-card facts
// ---------------------------------------------------------------------------

/** A decision field a card may show. Deliberately small: every entry here has
 *  to survive "is this real for THIS store", and an invented one is worse than
 *  a missing one. */
export type StoreFactKey = "catalog" | "offers" | "providers" | "sections";

/** Everything known about one store that a card might surface. Anything absent,
 *  null or zero is simply not rendered — there is no placeholder, no "—", and
 *  no guess. */
export type StoreFactSource = {
  catalogCount?: number | null;
  hasOffers?: boolean | null;
  providerCount?: number | null;
  sectionCount?: number | null;
};

export type StoreFact =
  | { key: "catalog"; noun: CatalogNoun; count: number }
  | { key: "offers" }
  | { key: "providers"; count: number }
  | { key: "sections"; count: number };

/** Which facts each sector puts on a card, in the order a buyer of that sector
 *  decides by. A grocery is judged on range and price; a clinic on who works
 *  there. Ordering, not availability — availability is the data's call below. */
const CARD_FACTS: Record<CategoryKey, StoreFactKey[]> = {
  retail: ["offers", "catalog", "sections"],
  farm: ["offers", "catalog"],
  pharmacy: ["catalog", "offers"],
  food: ["offers", "catalog", "sections"],
  healthcare: ["providers", "catalog"],
  professional: ["providers", "catalog"],
  contractors: ["catalog"],
  services: ["catalog"],
  beauty: ["providers", "catalog", "offers"],
  petCare: ["providers", "catalog"],
  fitness: ["catalog", "providers"],
  sportsCourts: ["catalog"],
  education: ["catalog", "providers"],
  hospitality: ["catalog"],
  events: ["catalog"],
  realEstate: ["catalog"],
  automotive: ["catalog", "offers"],
};

/**
 * The facts this card will render.
 *
 * A clinic, a restaurant and a shop share one card and one code path; what
 * differs is which of these lines has a value and what the count is called. A
 * field with no source is omitted entirely — never zero-filled, never faked.
 */
export function resolveCardFacts(
  category: CategoryKey,
  source: StoreFactSource,
): StoreFact[] {
  const noun = catalogNoun(category);
  const out: StoreFact[] = [];
  for (const key of CARD_FACTS[category]) {
    if (key === "catalog" && (source.catalogCount ?? 0) > 0)
      out.push({ key, noun, count: source.catalogCount as number });
    else if (key === "offers" && source.hasOffers === true) out.push({ key });
    else if (key === "providers" && (source.providerCount ?? 0) > 0)
      out.push({ key, count: source.providerCount as number });
    else if (key === "sections" && (source.sectionCount ?? 0) > 1)
      // One section is how the catalogue looks before anyone organised it.
      out.push({ key, count: source.sectionCount as number });
  }
  return out;
}

// ---------------------------------------------------------------------------
// URL state — the contract that makes a filtered view shareable
// ---------------------------------------------------------------------------

export type DiscoverySort = "recommended" | "newest" | "topRated";
export const DISCOVERY_SORTS: DiscoverySort[] = [
  "recommended",
  "newest",
  "topRated",
];

export const DISCOVERY_PAGE_SIZE = 24;

export type DiscoveryQuery = {
  q: string;
  group: GroupKey | null;
  sector: CategoryKey | null;
  region: RegionKey | null;
  openNow: boolean;
  hasCatalog: boolean;
  hasOffers: boolean;
  rated: boolean;
  verified: boolean;
  registered: boolean;
  sort: DiscoverySort;
  page: number;
};

export const DEFAULT_QUERY: DiscoveryQuery = {
  q: "",
  group: null,
  sector: null,
  region: null,
  openNow: false,
  hasCatalog: false,
  hasOffers: false,
  rated: false,
  verified: false,
  registered: false,
  sort: "recommended",
  page: 1,
};

/** Query-string spelling of each boolean. Short, because these end up in links
 *  people paste. */
const BOOL_PARAM: Record<
  "openNow" | "hasCatalog" | "hasOffers" | "rated" | "verified" | "registered",
  string
> = {
  openNow: "open",
  hasCatalog: "catalog",
  hasOffers: "offers",
  rated: "rated",
  verified: "verified",
  registered: "registered",
};

type RawParams = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

const oneOf = <T extends string>(
  v: string | string[] | undefined,
  allowed: readonly T[],
): T | null => {
  const s = one(v);
  return s && (allowed as readonly string[]).includes(s) ? (s as T) : null;
};

/**
 * Reads the query string into state.
 *
 * Unknown, misspelt and hostile values fall back to the default rather than
 * throwing or reaching the database — a pasted link with `?region=narnia` shows
 * the unfiltered page, which is the only harmless reading of it.
 */
export function parseDiscoveryQuery(sp: RawParams): DiscoveryQuery {
  const truthy = (v: string | string[] | undefined) => {
    const s = one(v);
    return s === "1" || s === "true";
  };
  const pageRaw = Number(one(sp.page));
  return {
    q: (one(sp.q) ?? "").trim().slice(0, 100),
    group: oneOf(sp.group, groupKeys),
    sector: oneOf(sp.sector, categoryKeys),
    region: oneOf(
      sp.region,
      regions.map((r) => r.key),
    ),
    openNow: truthy(sp[BOOL_PARAM.openNow]),
    hasCatalog: truthy(sp[BOOL_PARAM.hasCatalog]),
    hasOffers: truthy(sp[BOOL_PARAM.hasOffers]),
    rated: truthy(sp[BOOL_PARAM.rated]),
    verified: truthy(sp[BOOL_PARAM.verified]),
    registered: truthy(sp[BOOL_PARAM.registered]),
    sort: oneOf(sp.sort, DISCOVERY_SORTS) ?? "recommended",
    page:
      Number.isFinite(pageRaw) && pageRaw > 1 ? Math.floor(pageRaw) : 1,
  };
}

/**
 * Writes state back to a query string, omitting every default.
 *
 * Omitting defaults is what keeps one view at one URL: `/explore` and
 * `/explore?sort=recommended&page=1` must not be two addresses for the same
 * page, or search engines index both and neither ranks.
 */
export function discoveryParams(q: DiscoveryQuery): URLSearchParams {
  const p = new URLSearchParams();
  if (q.q.trim()) p.set("q", q.q.trim());
  if (q.group) p.set("group", q.group);
  if (q.sector) p.set("sector", q.sector);
  if (q.region) p.set("region", q.region);
  for (const [state, param] of Object.entries(BOOL_PARAM) as [
    keyof typeof BOOL_PARAM,
    string,
  ][]) {
    if (q[state]) p.set(param, "1");
  }
  if (q.sort !== "recommended") p.set("sort", q.sort);
  if (q.page > 1) p.set("page", String(q.page));
  return p;
}

/** A full href for a discovery state. `base` already carries the locale. */
export function discoveryHref(base: string, q: DiscoveryQuery): string {
  const qs = discoveryParams(q).toString();
  return qs ? `${base}?${qs}` : base;
}

/** A state with one thing changed — and the page reset, because page 4 of the
 *  old filter is a different, usually empty, page 4 of the new one. */
export function withQuery(
  q: DiscoveryQuery,
  patch: Partial<DiscoveryQuery>,
): DiscoveryQuery {
  const next = { ...q, ...patch };
  if (patch.page == null) next.page = 1;
  return next;
}

/** How many narrowing choices are active — the number on the phone's filter
 *  button. Sort and page are not filters and are not counted. */
export function activeFilterCount(q: DiscoveryQuery): number {
  let n = 0;
  if (q.group) n++;
  if (q.sector) n++;
  if (q.region) n++;
  for (const key of Object.keys(BOOL_PARAM) as (keyof typeof BOOL_PARAM)[]) {
    if (q[key]) n++;
  }
  return n;
}

/** Everything cleared except the text the buyer typed and the sector a category
 *  page is pinned to — clearing filters should not eject you from the page. */
export function clearedQuery(
  q: DiscoveryQuery,
  keep: { sector?: boolean } = {},
): DiscoveryQuery {
  return {
    ...DEFAULT_QUERY,
    q: q.q,
    sector: keep.sector ? q.sector : null,
    sort: q.sort,
  };
}
