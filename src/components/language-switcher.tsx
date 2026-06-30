import Link from "next/link";
import { locales, localeNames, type Locale } from "@/i18n/config";

// Segmented toggle that swaps the leading locale segment of the current path.
export function LanguageSwitcher({
  currentLocale,
  pathname,
}: {
  currentLocale: Locale;
  pathname: string;
}) {
  const rest = pathname.replace(/^\/(ar|en)(?=\/|$)/, "");

  return (
    <div className="inline-flex items-center rounded-lg border border-border bg-surface p-0.5">
      {locales.map((locale) => {
        const href = `/${locale}${rest}`;
        const isActive = locale === currentLocale;
        return (
          <Link
            key={locale}
            href={href}
            className={`rounded-md px-2.5 py-1 text-sm font-semibold transition-colors ${
              isActive
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {localeNames[locale]}
          </Link>
        );
      })}
    </div>
  );
}
