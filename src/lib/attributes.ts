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
  /** Surface this field as a buyer-facing filter on the sector's listing grid. */
  filter?: boolean;
};

// Extra structured fields shown per business sector. realEstate and automotive
// are listing-driven sectors, so their fields double as buyer filters — a home
// buyer filters by purpose/rooms, a car buyer by gearbox/fuel.
export const categoryAttributes: Partial<Record<CategoryKey, AttrField[]>> = {
  services: [
    { key: "duration", ar: "المدّة", en: "Duration", type: "number", unit: { ar: "دقيقة", en: "min" } },
  ],
  healthcare: [
    { key: "duration", ar: "المدّة", en: "Duration", type: "number", unit: { ar: "دقيقة", en: "min" } },
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
    { key: "rooms", ar: "عدد الغرف", en: "Bedrooms", type: "number", unit: { ar: "غرف", en: "bd" }, filter: true },
    { key: "bathrooms", ar: "الحمّامات", en: "Bathrooms", type: "number", unit: { ar: "حمّام", en: "ba" } },
    { key: "area", ar: "المساحة (م²)", en: "Area (m²)", type: "number", unit: { ar: "م²", en: "m²" } },
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
    { key: "brand", ar: "الماركة", en: "Brand", type: "text", filter: true },
    { key: "model", ar: "الموديل", en: "Model", type: "text" },
    { key: "year", ar: "السنة", en: "Year", type: "number" },
    { key: "mileage", ar: "المسافة (كم)", en: "Mileage (km)", type: "number", unit: { ar: "كم", en: "km" } },
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
