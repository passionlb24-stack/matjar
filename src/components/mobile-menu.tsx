"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Menu,
  X,
  Compass,
  ShoppingBag,
  Percent,
  Zap,
  TrendingUp,
  Map as MapIcon,
  Store,
  LayoutDashboard,
  User,
  LogIn,
} from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";

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

  const nav: Item[] = [
    { href: `/${lang}/explore`, label: dict.common.explore, icon: Compass },
    { href: `/${lang}/market`, label: dict.market.nav, icon: ShoppingBag, bold: true },
    { href: `/${lang}/offers`, label: dict.offers.title, icon: Percent },
    { href: `/${lang}/flash`, label: dict.flash.title, icon: Zap },
    { href: `/${lang}/best-sellers`, label: dict.bestSellers.title, icon: TrendingUp },
    { href: `/${lang}/map`, label: dict.map.title, icon: MapIcon },
    { href: `/${lang}/pricing`, label: dict.common.forMerchants, icon: Store },
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
        aria-label="menu"
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
            <div className="space-y-1">
              {nav.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition-colors hover:bg-surface-muted ${
                      item.bold ? "font-bold text-primary" : "font-medium text-foreground"
                    }`}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </div>

            <div className="my-2 border-t border-border" />

            <div className="space-y-1">
              {account.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition-colors hover:bg-surface-muted ${
                      item.bold ? "font-bold text-primary" : "font-medium text-foreground"
                    }`}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </nav>
        </>
      )}
    </div>
  );
}
