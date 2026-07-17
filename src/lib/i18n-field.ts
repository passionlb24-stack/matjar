import type { Locale } from "@/i18n/config";

// Bilingual field picker: show the English override when the viewer is browsing
// in English and the override is non-empty; otherwise fall back to the primary
// (Arabic-first) value the merchant always fills in.
export function localized(
  primary: string,
  en: string | null | undefined,
  lang: Locale,
): string {
  return lang === "en" && en?.trim() ? en : primary;
}
