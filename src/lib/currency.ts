// Pure helpers (no server imports) so both server and client components can use
// them. The USD→LBP rate is read from app_settings (admin-editable) and passed in.

import type { Locale } from "@/i18n/config";

/** Options for {@link formatUsd}. */
export type FormatUsdOptions = {
  /** Round to at most 2 decimals before grouping — the money-of-record shape
   *  used by surfaces that settle real amounts (invoice, POS, supplier bills,
   *  merchant dashboard totals) where an unrounded float would leak. Trailing
   *  zeros are still dropped ($12.50 → "$12.5"), matching what those screens
   *  have always rendered; this option exists to centralise their arithmetic,
   *  not to restyle them. Catalog prices leave it off. */
  cents?: boolean;
};

/** "$1,200" / "$50" — canonical USD price formatter (thousands separator ≥1000).
 *  Single source of truth; replaces the ad-hoc formatPrice copies across pages.
 *
 *  With `{ cents: true }` the amount is rounded to 2 decimals first, so
 *  1234.5678 renders "$1,234.57" instead of "$1,234.568". */
export function formatUsd(price: number, opts?: FormatUsdOptions): string {
  if (opts?.cents) {
    return `$${Number(Number(price).toFixed(2)).toLocaleString("en-US")}`;
  }
  return price >= 1000 ? `$${Number(price).toLocaleString("en-US")}` : `$${price}`;
}

/** "≈ 4,475,000 ل.ل." — an approximate LBP value for a USD amount. */
export function formatLbp(usd: number, rate: number, lang: Locale): string {
  if (!rate || usd <= 0) return "";
  const lbp = Math.round(usd * rate);
  return `≈ ${lbp.toLocaleString("en-US")} ${lang === "ar" ? "ل.ل." : "LBP"}`;
}
