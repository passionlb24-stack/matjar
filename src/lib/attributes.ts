import type { CategoryKey } from "@/lib/catalog";

export type AttrField = {
  key: string;
  ar: string;
  en: string;
  type: "text" | "number";
};

// Extra structured fields shown per business sector.
export const categoryAttributes: Partial<Record<CategoryKey, AttrField[]>> = {
  realEstate: [
    { key: "rooms", ar: "غرف", en: "Rooms", type: "number" },
    { key: "area", ar: "المساحة (م²)", en: "Area (m²)", type: "number" },
    { key: "bathrooms", ar: "حمّامات", en: "Bathrooms", type: "number" },
  ],
  automotive: [
    { key: "brand", ar: "الماركة", en: "Brand", type: "text" },
    { key: "model", ar: "الموديل", en: "Model", type: "text" },
    { key: "year", ar: "السنة", en: "Year", type: "number" },
    { key: "mileage", ar: "المسافة (كم)", en: "Mileage (km)", type: "number" },
  ],
};

// Builds a short display string like "3 غرف · 140 م²" from stored attributes.
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
      return `${v} ${lang === "ar" ? f.ar : f.en}`;
    })
    .filter(Boolean)
    .join(" · ");
}
