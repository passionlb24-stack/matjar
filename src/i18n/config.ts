// Central i18n configuration for Matjar.
// Arabic is the default locale (Lebanon-first), English is secondary.

export const locales = ["ar", "en"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "ar";

/** Text direction per locale — drives the `dir` attribute on <html>. */
export const localeDirection: Record<Locale, "rtl" | "ltr"> = {
  ar: "rtl",
  en: "ltr",
};

/** Native display name for each locale, used in the language switcher. */
export const localeNames: Record<Locale, string> = {
  ar: "العربية",
  en: "English",
};

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}
