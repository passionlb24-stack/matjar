import Link from "next/link";
import { locales, localeNames, type Locale } from "@/i18n/config";

// Swaps the leading locale segment of the current path while preserving the rest.
export function LanguageSwitcher({
  currentLocale,
  pathname,
}: {
  currentLocale: Locale;
  pathname: string;
}) {
  const rest = pathname.replace(/^\/(ar|en)(?=\/|$)/, "") || "/";

  return (
    <div className="flex items-center gap-1 text-sm">
      {locales.map((locale) => {
        const href = `/${locale}${rest === "/" ? "" : rest}` || `/${locale}`;
        const isActive = locale === currentLocale;
        return (
          <Link
            key={locale}
            href={href || `/${locale}`}
            className={
              isActive
                ? "rounded-md bg-foreground px-3 py-1.5 font-medium text-background"
                : "rounded-md px-3 py-1.5 text-foreground/70 hover:bg-foreground/5"
            }
          >
            {localeNames[locale]}
          </Link>
        );
      })}
    </div>
  );
}
