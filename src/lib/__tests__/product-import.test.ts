import { describe, it, expect } from "vitest";
import {
  IMPORT_COLUMNS,
  normalizeHeader,
  matchHeaders,
  hasRequiredColumns,
  parseNumericCell,
  validateRow,
  reviewRows,
  countNew,
  type RawRow,
} from "@/lib/product-import";

const AR = IMPORT_COLUMNS.map((c) => c.ar);
const EN = IMPORT_COLUMNS.map((c) => c.en);

describe("normalizeHeader", () => {
  it("folds the alef and taa-marbuta spellings people actually type", () => {
    expect(normalizeHeader("الأسم")).toBe(normalizeHeader("الاسم"));
    expect(normalizeHeader("الماركه")).toBe(normalizeHeader("الماركة"));
  });

  it("ignores harakat, tatweel and stray whitespace from Excel", () => {
    expect(normalizeHeader("  الاسْم  ")).toBe(normalizeHeader("الاسم"));
    expect(normalizeHeader("الاســـم")).toBe(normalizeHeader("الاسم"));
  });

  it("is case-insensitive for English headers", () => {
    expect(normalizeHeader("PRICE")).toBe(normalizeHeader("price"));
  });
});

describe("matchHeaders", () => {
  it("reads the Arabic template", () => {
    const found = matchHeaders(AR);
    expect(hasRequiredColumns(found)).toBe(true);
    expect(found.name).toBe(1);
    expect(found.price).toBe(2);
  });

  it("reads the English headings too", () => {
    expect(hasRequiredColumns(matchHeaders(EN))).toBe(true);
  });

  // The point of matching by text: a merchant who drags columns around, or
  // pastes their catalogue next to an unrelated column, still imports.
  it("follows reordered columns", () => {
    const found = matchHeaders(["السعر", "الاسم"]);
    expect(found.price).toBe(0);
    expect(found.name).toBe(1);
  });

  it("ignores columns it doesn't recognise", () => {
    const found = matchHeaders(["ملاحظاتي", "الاسم", "", "السعر"]);
    expect(found.name).toBe(1);
    expect(found.price).toBe(3);
    expect(hasRequiredColumns(found)).toBe(true);
  });

  it("reports a header row missing a required column", () => {
    expect(hasRequiredColumns(matchHeaders(["الاسم", "الماركة"]))).toBe(false);
    expect(hasRequiredColumns(matchHeaders([]))).toBe(false);
  });

  it("keeps the first match when a heading is duplicated", () => {
    expect(matchHeaders(["الاسم", "الاسم", "السعر"]).name).toBe(0);
  });
});

// These have to agree with parse_numeric_cell() in migration 0214: a row the
// preview accepts and the database rejects is the worst outcome, because the
// merchant has already been told it was fine.
describe("parseNumericCell", () => {
  it("accepts the comma decimal separator", () => {
    expect(parseNumericCell("12,50")).toBe(12.5);
  });

  it("strips currency symbols and spacing", () => {
    expect(parseNumericCell("$1 200")).toBe(1200);
    expect(parseNumericCell(" 7 ")).toBe(7);
  });

  it("returns null for blank and for text", () => {
    expect(parseNumericCell("")).toBeNull();
    expect(parseNumericCell("   ")).toBeNull();
    expect(parseNumericCell(undefined)).toBeNull();
    expect(parseNumericCell("abc")).toBeNull();
    expect(parseNumericCell("-")).toBeNull();
  });

  it("keeps zero, which is a real price and not a blank", () => {
    expect(parseNumericCell("0")).toBe(0);
  });
});

describe("validateRow", () => {
  const good: RawRow = { name: "قميص", price: "15" };

  it("accepts a row with just a name and a price", () => {
    expect(validateRow(good)).toBeNull();
  });

  it("rejects an empty or whitespace-only name", () => {
    expect(validateRow({ ...good, name: "" })).toBe("errName");
    expect(validateRow({ ...good, name: "   " })).toBe("errName");
  });

  it("rejects a missing, non-numeric or negative price", () => {
    expect(validateRow({ name: "قميص" })).toBe("errPrice");
    expect(validateRow({ ...good, price: "غالي" })).toBe("errPrice");
    expect(validateRow({ ...good, price: "-5" })).toBe("errPrice");
  });

  it("accepts a zero price", () => {
    expect(validateRow({ ...good, price: "0" })).toBeNull();
  });

  it("only checks the optional numbers when they are filled in", () => {
    expect(validateRow({ ...good, stock: "" })).toBeNull();
    expect(validateRow({ ...good, discount_price: "  " })).toBeNull();
    expect(validateRow({ ...good, stock: "لا يوجد" })).toBe("errStock");
    expect(validateRow({ ...good, discount_price: "مجاناً" })).toBe("errDiscount");
  });
});

describe("reviewRows", () => {
  it("separates importable rows from the ones to fix", () => {
    const { ok, problems } = reviewRows([
      { name: "قميص", price: "15" },
      { name: "", price: "10" },
      { name: "بنطلون", price: "20" },
    ]);
    expect(ok).toHaveLength(2);
    expect(problems).toEqual([{ index: 3, error: "errName" }]);
  });

  // The merchant is looking at Excel, where the header is line 1 and the first
  // product is line 2. Reporting a 0-based index would send them to the wrong row.
  it("reports the line number as Excel shows it", () => {
    const { problems } = reviewRows([{ name: "", price: "1" }]);
    expect(problems[0].index).toBe(2);
  });

  it("handles an empty file", () => {
    expect(reviewRows([])).toEqual({ ok: [], problems: [] });
  });
});

describe("countNew", () => {
  const existing = new Set(["a-1", "b-2"]);

  it("counts a known sku as an update, not an addition", () => {
    expect(countNew([{ name: "x", price: "1", sku: "A-1" }], existing)).toBe(0);
  });

  it("counts an unknown sku as new", () => {
    expect(countNew([{ name: "x", price: "1", sku: "c-3" }], existing)).toBe(1);
  });

  it("counts a row with no sku as new, since nothing can match it", () => {
    expect(countNew([{ name: "x", price: "1" }], existing)).toBe(1);
    expect(countNew([{ name: "x", price: "1", sku: "  " }], existing)).toBe(1);
  });

  it("matches skus case-insensitively, like the database index does", () => {
    expect(countNew([{ name: "x", price: "1", sku: "B-2" }], existing)).toBe(0);
  });
});
