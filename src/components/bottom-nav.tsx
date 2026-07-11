"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Store, ShoppingBag, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";

// Native-style bottom tab bar for phones (hidden ≥ lg). Gives the app its
// primary navigation with one thumb; respects the home-indicator safe area.
export function BottomNav({
  lang,
  dict,
  signedIn,
}: {
  lang: Locale;
  dict: Dictionary;
  signedIn: boolean;
}) {
  const pathname = usePathname();
  const t = dict.tabbar;
  const base = `/${lang}`;

  const tabs: { href: string; label: string; Icon: LucideIcon; exact?: boolean }[] =
    [
      { href: base, label: t.home, Icon: Home, exact: true },
      { href: `${base}/explore`, label: t.explore, Icon: Store },
      { href: `${base}/market`, label: t.market, Icon: ShoppingBag },
      {
        href: signedIn ? `${base}/account` : `${base}/login`,
        label: t.account,
        Icon: User,
      },
    ];

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <nav
      aria-label={t.home}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-surface/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] lg:hidden print:hidden"
    >
      <ul className="flex items-stretch">
        {tabs.map((tab) => {
          const active = isActive(tab.href, tab.exact);
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors ${
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <tab.Icon
                  className="h-5 w-5"
                  strokeWidth={active ? 2.4 : 1.9}
                />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
