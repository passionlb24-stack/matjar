"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Compass, Receipt, Heart, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";

// Native-style bottom tab bar for phones (hidden ≥ lg). Gives the app its
// primary navigation with one thumb; respects the home-indicator safe area.
export function BottomNav({
  lang,
  dict,
  signedIn,
  activityCount = 0,
}: {
  lang: Locale;
  dict: Pick<Dictionary, "tabbar">;
  signedIn: boolean;
  /** Items waiting on the CUSTOMER — an order to review, an appointment to
   *  attend. Never a count of everything open, or the badge becomes a number
   *  they cannot clear. */
  activityCount?: number;
}) {
  const pathname = usePathname();
  const t = dict.tabbar;
  const base = `/${lang}`;

  // Five tabs, and five is the ceiling: at 360px a sixth leaves each ~60px,
  // under a comfortable thumb target. Classifieds (/market) moved into Explore
  // as a segment to free this slot — a customer needs "where is my order?" far
  // more often than a separate entrance to listings.
  //
  // Signed-out users still see all five; tabs 3 and 4 route through login with
  // ?next=. A tab bar that changes shape on sign-in is disorienting.
  const tabs: {
    href: string;
    label: string;
    Icon: LucideIcon;
    exact?: boolean;
    badge?: number;
  }[] = [
    { href: base, label: t.home, Icon: Home, exact: true },
    { href: `${base}/explore`, label: t.explore, Icon: Compass },
    {
      href: signedIn
        ? `${base}/activity`
        : `${base}/login?next=${base}/activity`,
      label: t.activity,
      Icon: Receipt,
      badge: activityCount,
    },
    {
      href: signedIn
        ? `${base}/favorites`
        : `${base}/login?next=${base}/favorites`,
      label: t.favorites,
      Icon: Heart,
    },
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
                /* Opts this link into the app's press state (globals.css).
                   A tab that does not acknowledge the finger is one of the
                   loudest "this is a web page" tells in the shell: the tap
                   registers and then nothing happens until the next route
                   paints. In a browser this attribute does nothing at all —
                   the rule behind it is scoped to html[data-app="native"]. */
                data-press
                aria-current={active ? "page" : undefined}
                aria-label={
                  tab.badge ? `${tab.label} (${tab.badge})` : undefined
                }
                className={`flex h-[var(--m-tabbar-h)] flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors ${
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="relative">
                  <tab.Icon
                    className="h-5 w-5"
                    strokeWidth={active ? 2.4 : 1.9}
                  />
                  {!!tab.badge && tab.badge > 0 && (
                    <span
                      className="absolute -end-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-strong px-1 text-[10px] font-bold text-danger-strong-foreground"
                      aria-hidden
                    >
                      {tab.badge > 9 ? "9+" : tab.badge}
                    </span>
                  )}
                </span>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
