import type { CategoryKey } from "@/lib/catalog";

export type AttrOption = { value: string; ar: string; en: string };

export type AttrField = {
  key: string;
  /** Form-field label. */
  ar: string;
  en: string;
  type: "text" | "number" | "select";
  /** Appended after the value in the summary line (e.g. "م²", "كم"). Numbers
   *  without a unit show the value alone; text shows the value alone. */
  unit?: { ar: string; en: string };
  /** For type: "select" — the allowed values and their bilingual labels. */
  options?: AttrOption[];
  /** Surface this field as a buyer-facing filter on the sector's listing grid.
   *  Declares INTENT only — whether the control actually renders is the live
   *  data's call, via attributeFacet()/attrRangeBounds() below. */
  filter?: boolean;
  /**
   * A `number` field a buyer thinks about as a span, not a value: "under $50",
   * "2015 or newer", "80–120 m²". Nobody picks a mileage off a dropdown.
   *
   * This is a declaration, not a rendered control. A range needs two things a
   * dropdown does not — a numeric column or cast to compare against, and enough
   * rows to have a spread at all — and the second is checked at render time by
   * attrRangeBounds(). See the note on MJ-013 at the foot of this file for what
   * is and is not wired today.
   */
  range?: boolean;
  /**
   * Superseded: still READ so stored values keep rendering, never OFFERED for
   * entry again.
   *
   * `duration` is the only such field. It predates the real `duration_minutes`
   * column on products, and once that column arrived a clinic's create form
   * showed the merchant TWO duration inputs with no way to tell them apart. In
   * production six of the seven clinic services filled this one and the seventh
   * filled the column, so six services carry a duration the booking engine —
   * which reads `duration_minutes` — cannot see. Retiring the field from entry
   * stops the split widening; migration 0296 backfills the six rows that already
   * exist, after which this entry can be deleted outright.
   */
  legacy?: boolean;
};

// Extra structured fields shown per business sector.
//
// What belongs here is what the sector's own catalogue rows differ BY — the
// thing a shopkeeper would say out loud about one item and not the next. What
// does not belong here is anything `products` already has a real column for:
// `brand`, `sku`, `stock`, `cost` and `duration_minutes` are columns, and a
// second copy of any of them in jsonb is not a richer description, it is two
// answers to one question (see `legacy` above for how that actually played out).
//
// Sizes and colours are absent for the same reason: they are variants, with
// their own table and their own matrix editor in the product form.
export const categoryAttributes: Partial<Record<CategoryKey, AttrField[]>> = {
  // Retail is the largest sector on the platform — eleven stores, forty-one
  // products — and defined no attributes at all, so a shop could publish a
  // catalogue in which nothing distinguished one row from another beyond its
  // name and its price. These six are the questions a Lebanese shopper actually
  // asks across a mixed high-street catalogue: is it new, where is it from,
  // what is it made of, how big, is it under warranty, and is it off the shelf
  // or made to order.
  retail: [
    {
      key: "condition",
      ar: "الحالة",
      en: "Condition",
      type: "select",
      options: [
        { value: "new", ar: "جديد", en: "New" },
        { value: "used", ar: "مستعمل", en: "Used" },
      ],
    },
    // "منشأ" is the word on the shelf-talker in every Tripoli shop — the first
    // thing asked about an appliance or a length of cloth.
    { key: "origin", ar: "المنشأ", en: "Made in", type: "text" },
    { key: "material", ar: "المادة", en: "Material", type: "text" },
    { key: "dimensions", ar: "القياس (سم)", en: "Dimensions (cm)", type: "text" },
    { key: "warranty", ar: "الكفالة", en: "Warranty", type: "number", unit: { ar: "شهر", en: "mo" } },
    {
      key: "madeToOrder",
      ar: "جاهز أو تفصيل",
      en: "Ready-made or made to order",
      type: "select",
      options: [
        { value: "ready", ar: "جاهز", en: "Ready-made" },
        { value: "made", ar: "تفصيل", en: "Made to order" },
      ],
    },
  ],
  // A menu row differs by heat, by how many people it feeds, and by whether
  // someone who does not eat meat can order it. Allergens are deliberately NOT
  // here: a half-filled allergen field reads as "contains none", and a blank
  // that a customer takes for an assurance is worse than no field at all.
  food: [
    {
      key: "spicy",
      ar: "حار",
      en: "Spicy",
      type: "select",
      options: [
        { value: "no", ar: "مش حار", en: "Not spicy" },
        { value: "mild", ar: "وسط", en: "Medium" },
        { value: "hot", ar: "حار كتير", en: "Very spicy" },
      ],
    },
    { key: "serves", ar: "بيكفّي", en: "Serves", type: "number", unit: { ar: "شخص", en: "people" } },
    {
      key: "dietary",
      // Left blank = an ordinary dish. Only the two positive claims are
      // options, because "not vegetarian" is not a thing a kitchen declares.
      ar: "نباتي",
      en: "Dietary",
      type: "select",
      options: [
        { value: "vegetarian", ar: "نباتي", en: "Vegetarian" },
        { value: "vegan", ar: "نباتي صرف", en: "Vegan" },
      ],
    },
  ],
  // Salons here are usually for one gender or the other, sell courses of
  // treatment by the session, and half of them will come to the house.
  // Duration is NOT here — `duration_minutes` is the real column.
  beauty: [
    {
      key: "audience",
      ar: "لمين",
      en: "For whom",
      type: "select",
      options: [
        { value: "women", ar: "للنساء", en: "Women" },
        { value: "men", ar: "للرجال", en: "Men" },
        { value: "both", ar: "للجميع", en: "Everyone" },
      ],
    },
    { key: "sessions", ar: "عدد الجلسات", en: "Sessions", type: "number", unit: { ar: "جلسة", en: "sessions" } },
    {
      key: "venue",
      ar: "مكان الخدمة",
      en: "Where",
      type: "select",
      options: [
        { value: "shop", ar: "بالصالون", en: "At the salon" },
        { value: "home", ar: "عالبيت", en: "At your place" },
      ],
    },
  ],
  services: [
    { key: "duration", ar: "المدّة", en: "Duration", type: "number", unit: { ar: "دقيقة", en: "min" }, legacy: true },
    {
      key: "venue",
      ar: "مكان الشغل",
      en: "Where",
      type: "select",
      options: [
        { value: "shop", ar: "بالمحل", en: "At our workshop" },
        { value: "home", ar: "عند الزبون", en: "At the customer" },
      ],
    },
    // A tradesman's كفالة is on the labour, and it is the thing that wins the
    // job — it belongs on the card, not in a conversation.
    { key: "warranty", ar: "الكفالة عالشغل", en: "Warranty on work", type: "number", unit: { ar: "شهر", en: "mo" } },
  ],
  // A clinic service is described by its duration, which is a real column, and
  // by the two things a patient rings up to ask: do I have to come fasting, and
  // when do I get the result. Both are operational facts the receptionist
  // already repeats all day — not clinical claims.
  healthcare: [
    { key: "duration", ar: "المدّة", en: "Duration", type: "number", unit: { ar: "دقيقة", en: "min" }, legacy: true },
    {
      key: "prep",
      ar: "تحضير مطلوب",
      en: "Preparation",
      type: "select",
      options: [
        { value: "fasting", ar: "بدّو صيام", en: "Fasting required" },
        { value: "none", ar: "بلا تحضير", en: "No preparation" },
      ],
    },
    { key: "resultTime", ar: "وقت النتيجة", en: "Results ready in", type: "text" },
  ],
  realEstate: [
    {
      key: "purpose",
      ar: "الغرض",
      en: "Purpose",
      type: "select",
      filter: true,
      options: [
        { value: "sale", ar: "للبيع", en: "For sale" },
        { value: "rent", ar: "للإيجار", en: "For rent" },
      ],
    },
    {
      key: "ptype",
      ar: "نوع العقار",
      en: "Property type",
      type: "select",
      filter: true,
      options: [
        { value: "apartment", ar: "شقة", en: "Apartment" },
        { value: "house", ar: "منزل/فيلا", en: "House/Villa" },
        { value: "land", ar: "أرض", en: "Land" },
        { value: "office", ar: "مكتب", en: "Office" },
        { value: "shop", ar: "محل", en: "Shop" },
        { value: "chalet", ar: "شاليه", en: "Chalet" },
      ],
    },
    // Bedrooms stays a dropdown, and keeps the filter flag it already had: a
    // flat is one, two, three or four bedrooms, and picking that off a list is
    // how every listing site does it. Not everything numeric is a range.
    { key: "rooms", ar: "عدد الغرف", en: "Bedrooms", type: "number", unit: { ar: "غرف", en: "bd" }, filter: true },
    { key: "bathrooms", ar: "الحمّامات", en: "Bathrooms", type: "number", unit: { ar: "حمّام", en: "ba" } },
    // `range` without `filter`: see the MJ-013 note at the foot of the file.
    // The only control that exists today turns a filterable field into a
    // dropdown of its distinct values, which for an area or a mileage is one
    // entry per listing. The range is declared; the flag that would render it
    // as a dropdown is deliberately not set.
    { key: "area", ar: "المساحة (م²)", en: "Area (m²)", type: "number", unit: { ar: "م²", en: "m²" }, range: true },
    {
      key: "furnished",
      ar: "مفروش",
      en: "Furnished",
      type: "select",
      options: [
        { value: "yes", ar: "مفروش", en: "Furnished" },
        { value: "no", ar: "غير مفروش", en: "Unfurnished" },
      ],
    },
  ],
  automotive: [
    // `brand` used to be declared here as a text attribute. It is a real column
    // on products — the storefront's brand chips are built from `p.brand`, not
    // from jsonb — so a dealer typing "Kia" into the attribute filed it where
    // the brand filter does not look. Same defect as `duration`, caught by the
    // no-shadowing test below. Removed outright rather than retired because
    // automotive has two stores and zero catalogue rows in production: there is
    // no stored value to preserve.
    { key: "model", ar: "الموديل", en: "Model", type: "text" },
    { key: "year", ar: "السنة", en: "Year", type: "number", range: true },
    { key: "mileage", ar: "المسافة (كم)", en: "Mileage (km)", type: "number", unit: { ar: "كم", en: "km" }, range: true },
    {
      key: "gearbox",
      ar: "ناقل الحركة",
      en: "Gearbox",
      type: "select",
      filter: true,
      options: [
        { value: "automatic", ar: "أوتوماتيك", en: "Automatic" },
        { value: "manual", ar: "عادي", en: "Manual" },
      ],
    },
    {
      key: "fuel",
      ar: "الوقود",
      en: "Fuel",
      type: "select",
      filter: true,
      options: [
        { value: "petrol", ar: "بنزين", en: "Petrol" },
        { value: "diesel", ar: "ديزل", en: "Diesel" },
        { value: "hybrid", ar: "هايبرد", en: "Hybrid" },
        { value: "electric", ar: "كهرباء", en: "Electric" },
      ],
    },
    {
      key: "condition",
      ar: "الحالة",
      en: "Condition",
      type: "select",
      filter: true,
      options: [
        { value: "new", ar: "جديدة", en: "New" },
        { value: "used", ar: "مستعملة", en: "Used" },
      ],
    },
  ],
};

/** Every field the sector knows about, entry and retired alike. Read side. */
export function attrFields(category: CategoryKey): AttrField[] {
  return categoryAttributes[category] ?? [];
}

/** The fields a merchant is asked to fill. Write side — this is what the create
 *  and edit forms render, and a retired field must never appear on it again. */
export function attrEntryFields(category: CategoryKey): AttrField[] {
  return attrFields(category).filter((f) => !f.legacy);
}

/** Retired fields, whose stored values must be carried across an edit rather
 *  than dropped. The edit form rebuilds `attributes` from the fields it
 *  rendered, so anything it does not render is erased on save — which is
 *  exactly how a clinic editing its price would silently lose the duration it
 *  typed last year. */
export function attrLegacyFields(category: CategoryKey): AttrField[] {
  return attrFields(category).filter((f) => f.legacy);
}

// ---------------------------------------------------------------------------
// Filter availability — the same rule discovery.ts applies to stores, applied
// to a catalogue
// ---------------------------------------------------------------------------
//
// discovery.ts refuses to render a store filter that no store passes (`empty`)
// or that every store passes (`universal`), because both are controls that
// cannot narrow anything and a screen that will not narrow reads as broken.
// Attribute filters had no such rule: a `select` field offered its declared
// options whether or not a single row in the catalogue carried one of them, so
// a "Condition: new / used" dropdown over forty-one products that record no
// condition is a control whose every setting empties the grid.
//
// These helpers answer the question from the ROWS instead of from the schema.

/** A row of any catalogue table that can carry attributes. */
export type AttrRow = { attributes?: Record<string, string> | null };

const valueOf = (row: AttrRow, key: string): string =>
  (row.attributes?.[key] ?? "").trim();

/** How many rows actually record a value for this field. */
export function attrCoverage(field: AttrField, rows: readonly AttrRow[]): number {
  return rows.filter((r) => valueOf(r, field.key) !== "").length;
}

/**
 * The options worth offering: those with at least one row behind them, in
 * declared order. A `select` keeps its bilingual labels; a text/number field
 * derives its options from the distinct values present.
 */
export function attrFacetOptions(
  field: AttrField,
  rows: readonly AttrRow[],
): AttrOption[] {
  const present = new Set(
    rows.map((r) => valueOf(r, field.key)).filter((v) => v !== ""),
  );
  if (field.type === "select")
    return (field.options ?? []).filter((o) => present.has(o.value));
  return [...present]
    .sort((a, b) =>
      field.type === "number" ? Number(a) - Number(b) : a.localeCompare(b),
    )
    .map((v) => ({ value: v, ar: v, en: v }));
}

/** One surviving option is not a choice, it is a label — the same floor
 *  discovery.ts sets for a store facet (MIN_FACET_OPTIONS). */
export const MIN_ATTR_FACET_OPTIONS = 2;

/**
 * The low and high ends of a range control, or `null` when there is no range
 * to draw.
 *
 * Two rows carrying the same mileage do not make a mileage slider; they make a
 * slider with one position, which is the `universal` case under another name.
 */
export function attrRangeBounds(
  field: AttrField,
  rows: readonly AttrRow[],
): { min: number; max: number } | null {
  if (!field.range) return null;
  const values = rows
    .map((r) => valueOf(r, field.key))
    .filter((v) => v !== "")
    .map(Number)
    .filter((n) => Number.isFinite(n));
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  return min < max ? { min, max } : null;
}

/**
 * The attribute filters this catalogue can actually offer.
 *
 * Intent (`filter: true`) intersected with the live rows, exactly as
 * resolveFilters() intersects a sector's declared filters with DiscoveryCoverage.
 * A range field survives on having a spread; every other field survives on
 * offering at least two populated choices.
 */
export function attributeFilterFields(
  category: CategoryKey,
  rows: readonly AttrRow[],
): AttrField[] {
  return attrFields(category)
    .filter((f) => f.filter && !f.legacy)
    .filter((f) =>
      f.range
        ? attrRangeBounds(f, rows) !== null
        : attrFacetOptions(f, rows).length >= MIN_ATTR_FACET_OPTIONS,
    );
}

/** The label to show for a stored value (translates select values via options). */
export function attrValueLabel(
  field: AttrField,
  value: string,
  lang: "ar" | "en",
): string {
  if (field.type === "select") {
    const opt = field.options?.find((o) => o.value === value);
    if (opt) return lang === "ar" ? opt.ar : opt.en;
    return value;
  }
  const unit = field.unit ? (lang === "ar" ? field.unit.ar : field.unit.en) : "";
  return unit ? `${value} ${unit}` : value;
}

// Builds a short display string like "للبيع · 3 غرف · 140 م²" from stored
// attributes, in the sector's field order.
export function attributeSummary(
  category: CategoryKey,
  attributes: Record<string, string> | null | undefined,
  lang: "ar" | "en",
): string {
  if (!attributes) return "";
  const fields = categoryAttributes[category];
  if (!fields) return "";
  return fields
    .map((f) => {
      const v = attributes[f.key];
      if (!v) return null;
      return attrValueLabel(f, v, lang);
    })
    .filter(Boolean)
    .join(" · ");
}

// ---------------------------------------------------------------------------
// MJ-013 — what is declared here and what is still missing
// ---------------------------------------------------------------------------
//
// `range: true` and attrRangeBounds() are the registry's half of the typed
// range filter. The other half is the CONTROL — two numeric inputs on the
// catalogue grid and a predicate that compares against them — and it lives in
// store-products.tsx, which this change does not touch.
//
// That half was left undone on purpose rather than by omission. Every field
// marked `range` belongs to realEstate or automotive, and in production those
// two sectors have two stores between them and not one catalogue row. A
// mileage slider over zero cars is the failure this file exists to prevent, so
// the declaration lands first and the control follows the inventory.
//
// The one range a buyer could use today is PRICE, which is not an attribute at
// all — it is a column on products, populated on all sixty-one priced rows,
// spanning $1.50 to $800 in retail alone. It needs no schema work, only the
// same control; /market already has that control for the listings table.
