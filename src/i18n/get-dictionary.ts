import "server-only";
import type { Locale } from "./config";

// Dictionaries are loaded on the server only, so translation files never
// ship to the client bundle. Add new locales here as the platform grows.
const dictionaries = {
  ar: () => import("./dictionaries/ar.json").then((m) => m.default),
  en: () => import("./dictionaries/en.json").then((m) => m.default),
};

export const getDictionary = async (locale: Locale) => dictionaries[locale]();

export type Dictionary = Awaited<ReturnType<typeof getDictionary>>;
