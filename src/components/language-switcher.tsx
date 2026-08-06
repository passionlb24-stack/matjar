"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { locales, localeNames, type Locale } from "@/i18n/config";

// Segmented toggle that swaps ONLY the leading locale segment of the CURRENT
// path — so switching language keeps you on the same page (it used to jump home
// because callers passed a hardcoded pathname).
//
// It also has to keep the query string. usePathname() returns the path alone,
// so switching language used to silently drop everything after the "?": the
// filters on explore, market, search and the other faceted pages, and — worse,
// because it is invisible and unrecoverable — the ?ref= that attributes a
// signup to whoever referred it. Someone landing on an Arabic referral link and
// switching to English became an organic signup, and the referrer was never
// paid.

function SwitcherLinks({
  currentLocale,
  query,
}: {
  currentLocale: Locale;
  query: string;
}) {
  const pathname = usePathname() || `/${currentLocale}`;
  const rest = pathname.replace(/^\/(ar|en)(?=\/|$)/, "");

  return (
    <div className="inline-flex items-center rounded-lg border border-border bg-surface p-0.5">
      {locales.map((locale) => {
        const href = `/${locale}${rest}${query ? `?${query}` : ""}`;
        const isActive = locale === currentLocale;
        return (
          <Link
            key={locale}
            href={href}
            // min-h-11 keeps the touch target at 44px while the pill itself
            // stays visually compact.
            className={`inline-flex min-h-11 items-center rounded-md px-2.5 text-sm font-semibold transition-colors ${
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

function SwitcherWithQuery({ currentLocale }: { currentLocale: Locale }) {
  const query = useSearchParams().toString();
  return <SwitcherLinks currentLocale={currentLocale} query={query} />;
}

export function LanguageSwitcher({ currentLocale }: { currentLocale: Locale }) {
  // useSearchParams opts everything above it out of static rendering unless it
  // sits behind a Suspense boundary. The boundary lives here rather than at the
  // five call sites so this stays a drop-in component, and the fallback is the
  // same switcher minus the query — during that first paint it behaves exactly
  // as it did before this change, never worse.
  return (
    <Suspense
      fallback={<SwitcherLinks currentLocale={currentLocale} query="" />}
    >
      <SwitcherWithQuery currentLocale={currentLocale} />
    </Suspense>
  );
}
