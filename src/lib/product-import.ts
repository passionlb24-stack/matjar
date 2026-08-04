// Reading a merchant's spreadsheet into rows the importer can accept.
//
// Everything here is pure: given a header row and cell values, decide which
// column is which and whether a row is usable. The file reading itself lives in
// the component; this is the part worth pinning with tests, because it is where
// a merchant's real file — reordered columns, an extra blank column, a price
// typed as "12,50 $" — either works or silently loses their catalogue.

export type ImportKey =
  | "sku"
  | "name"
  | "price"
  | "stock"
  | "discount_price"
  | "section"
  | "brand"
  | "description"
  | "image_url"
  | "name_en"
  | "description_en";

export type ColumnSpec = {
  key: ImportKey;
  /** Header text written into the template, and matched on the way back in. */
  ar: string;
  en: string;
  required?: boolean;
};

// Order here is the order in the generated template.
export const IMPORT_COLUMNS: ColumnSpec[] = [
  { key: "sku", ar: "رمز المنتج", en: "Code" },
  { key: "name", ar: "الاسم", en: "Name", required: true },
  { key: "price", ar: "السعر", en: "Price", required: true },
  { key: "stock", ar: "الكمية", en: "Quantity" },
  { key: "discount_price", ar: "سعر التخفيض", en: "Sale price" },
  { key: "section", ar: "القسم", en: "Section" },
  { key: "brand", ar: "الماركة", en: "Brand" },
  { key: "description", ar: "الوصف", en: "Description" },
  { key: "image_url", ar: "رابط الصورة", en: "Image link" },
  { key: "name_en", ar: "الاسم بالإنجليزي", en: "Name (English)" },
  { key: "description_en", ar: "الوصف بالإنجليزي", en: "Description (English)" },
];

/**
 * Arabic headers arrive with the diacritics and alef variants people actually
 * type, and Excel adds stray whitespace. Compare on a flattened form so
 * "الاسم" and "الأسم " are the same column.
 */
export function normalizeHeader(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[ً-ْـ]/g, "") // harakat + tatweel
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ");
}

/**
 * Map each known column to the index it sits at, by header text rather than by
 * position — a merchant who reorders or inserts a column should still import.
 * Unknown columns are ignored rather than treated as an error.
 */
export function matchHeaders(headerRow: unknown[]): Partial<Record<ImportKey, number>> {
  const found: Partial<Record<ImportKey, number>> = {};
  headerRow.forEach((cell, i) => {
    const h = normalizeHeader(cell);
    if (!h) return;
    for (const col of IMPORT_COLUMNS) {
      if (found[col.key] !== undefined) continue;
      if (h === normalizeHeader(col.ar) || h === normalizeHeader(col.en)) {
        found[col.key] = i;
        return;
      }
    }
  });
  return found;
}

/** A header row is usable only if the two required columns are in it. */
export function hasRequiredColumns(
  found: Partial<Record<ImportKey, number>>,
): boolean {
  return IMPORT_COLUMNS.filter((c) => c.required).every(
    (c) => found[c.key] !== undefined,
  );
}

export type RawRow = Partial<Record<ImportKey, string>>;

export type RowError =
  | "errName"
  | "errPrice"
  | "errDiscount"
  | "errStock";

/**
 * Mirrors parse_numeric_cell() in migration 0214. Both sides have to agree, or
 * a row the preview accepts would be rejected by the database — the worst
 * possible outcome, because the merchant has already been told it was fine.
 */
export function parseNumericCell(text: string | undefined | null): number | null {
  const raw = (text ?? "").trim();
  if (raw === "") return null;
  const cleaned = raw
    .replace(/,/g, ".")
    .replace(/\s/g, "")
    .replace(/[^0-9.-]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** null = the row is importable. */
export function validateRow(row: RawRow): RowError | null {
  if (!(row.name ?? "").trim()) return "errName";
  const price = parseNumericCell(row.price);
  if (price === null || price < 0) return "errPrice";
  if ((row.discount_price ?? "").trim() !== "" && parseNumericCell(row.discount_price) === null)
    return "errDiscount";
  if ((row.stock ?? "").trim() !== "" && parseNumericCell(row.stock) === null)
    return "errStock";
  return null;
}

export type ReviewedRow = { row: RawRow; index: number; error: RowError | null };

/** Split parsed rows into what will import and what the merchant must fix. */
export function reviewRows(rows: RawRow[]): {
  ok: RawRow[];
  problems: { index: number; error: RowError }[];
} {
  const ok: RawRow[] = [];
  const problems: { index: number; error: RowError }[] = [];
  rows.forEach((row, i) => {
    const error = validateRow(row);
    // +2: spreadsheets are 1-based and row 1 is the header, so this is the
    // line number the merchant sees in Excel.
    if (error) problems.push({ index: i + 2, error });
    else ok.push(row);
  });
  return { ok, problems };
}

/** Rows with no sku, or a sku not already in the store, grow the catalogue. */
export function countNew(rows: RawRow[], existingSkus: Set<string>): number {
  return rows.filter((r) => {
    const sku = (r.sku ?? "").trim().toLowerCase();
    return sku === "" || !existingSkus.has(sku);
  }).length;
}
