// Pure helpers (no server imports) so both server and client components can use
// them. The USD→LBP rate is read from app_settings (admin-editable) and passed in.

import type { Locale } from "@/i18n/config";

/** "≈ 4,475,000 ل.ل." — an approximate LBP value for a USD amount. */
export function formatLbp(usd: number, rate: number, lang: Locale): string {
  if (!rate || usd <= 0) return "";
  const lbp = Math.round(usd * rate);
  return `≈ ${lbp.toLocaleString("en-US")} ${lang === "ar" ? "ل.ل." : "LBP"}`;
}
