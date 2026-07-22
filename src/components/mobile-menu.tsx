"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  X,
  Compass,
  ShoppingBag,
  Percent,
  Zap,
  TrendingUp,
  Briefcase,
  Sparkles,
  Boxes,
  Truck,
  Map as MapIcon,
  Store,
  Wrench,
  Tag,
  LayoutDashboard,
  User,
  LogIn,
} from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { LogoutButton } from "@/components/logout-button";
import { isActivePath } from "@/components/nav-link";

type Item = { href: string; label: string; icon: typeof Compass; bold?: boolean };

export function MobileMenu({
  lang,
  dict,
  user,
  dashboardHref = null,
  lbpRate = 0,
}: {
  lang: Locale;
  dict: Dictionary;
  user: { name: string } | null;
  dashboardHref?: string | null;
  lbpRate?: number;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const sections: { title: string; items: Item[] }[] = [
    {
      title: dict.mobileNav.shop,
      items: [
        { href: `/${lang}/explore`, label: dict.common.explore, icon: Compass },
        { href: `/${lang}/market`, label: dict.market.nav, icon: ShoppingBag, bold: true },
        { href: `/${lang}/offers`, label: dict.offers.title, icon: Percent },
        { href: `/${lang}/flash`, label: dict.flash.title, icon: Zap },
        { href: `/${lang}/best-sellers`, label: dict.bestSellers.title, icon: TrendingUp },
      ],
    },
    {
      title: dict.common.workServices,
      items: [
        { href: `/${lang}/jobs`, label: dict.jobs.title, icon: Briefcase },
        { href: `/${lang}/freelance`, label: dict.freelance.title, icon: Sparkles },
        { href: `/${lang}/wholesale`, label: dict.wholesale.title, icon: Boxes },
        { href: `/${lang}/delivery`, label: dict.delivery.title, icon: Truck },
      ],
    },
    {
      title: dict.mobileNav.more,
      items: [
        { href: `/${lang}/merchants`, label: dict.common.forMerchants, icon: Store, bold: true },
        { href: `/${lang}/hub`, label: dict.common.hub, icon: Wrench },
        { href: `/${lang}/map`, label: dict.map.title, icon: MapIcon },
        { href: `/${lang}/pricing`, label: dict.pricing.title, icon: Tag },
      ],
    },
  ];

  const account: Item[] = user
    ? [
        ...(dashboardHref
          ? [{ href: dashboardHref, label: dict.dashboard.panel, icon: LayoutDashboard, bold: true }]
          : []),
        { href: `/${lang}/account`, label: user.name, icon: User },
      ]
    : [{ href: `/${lang}/login`, label: dict.common.login, icon: LogIn }];

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label={dict.common.menu}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-surface-muted"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 top-16 z-40 bg-black/30"
            onClick={() => setOpen(false)}
          />
          <nav className="fixed inset-x-0 top-16 z-40 max-h-[calc(100vh-4rem)] overflow-y-auto border-b border-border bg-background p-3 shadow-lg">
            {lbpRate > 0 && (
              <div className="mb-2 rounded-xl bg-surface-muted px-3 py-2 text-center text-sm font-bold text-muted-foreground">
                $1 = {lbpRate.toLocaleString("en-US")}{" "}
                {lang === "ar" ? "ل.ل." : "LBP"}
              </div>
            )}
            {sections.map((section, si) => (
              <div key={section.title} className={si > 0 ? "mt-3" : ""}>
                <p className="px-3 pb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  {section.title}
                </p>
                <div className="space-y-1">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        aria-current={isActivePath(pathname, item.href) ? "page" : undefined}
                        className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition-colors hover:bg-surface-muted aria-[current=page]:bg-surface-muted ${
                          item.bold ? "font-bold text-primary" : "font-medium text-foreground"
                        }`}
                      >
                        <Icon className="h-5 w-5 shrink-0" />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="my-2 border-t border-border" />

            <div className="space-y-1">
              {account.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={isActivePath(pathname, item.href) ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition-colors hover:bg-surface-muted aria-[current=page]:bg-surface-muted ${
                      item.bold ? "font-bold text-primary" : "font-medium text-foreground"
                    }`}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </div>

            {/* Language + theme live in the bar on desktop; on a phone they
                move here so the header can't overflow. */}
            <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-3">
              <LanguageSwitcher currentLocale={lang} />
              <ThemeToggle />
            </div>
            {user && (
              <div className="mt-1" onClick={() => setOpen(false)}>
                <LogoutButton label={dict.auth.logout} />
              </div>
            )}
          </nav>
        </>
      )}
    </div>
  );
}
