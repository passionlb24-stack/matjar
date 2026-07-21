"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  Store as StoreIcon,
  Users,
  Tags,
  CreditCard,
  BarChart3,
  Settings,
  ShoppingBag,
  Star,
  ScrollText,
  Truck,
  Receipt,
  BadgeCheck,
  Crown,
} from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { Container } from "@/components/ui/container";

const icons = {
  overview: LayoutGrid,
  stores: StoreIcon,
  orders: Receipt,
  users: Users,
  types: Tags,
  market: ShoppingBag,
  delivery: Truck,
  reviews: Star,
  verifications: BadgeCheck,
  leaders: Crown,
  subscriptions: CreditCard,
  reports: BarChart3,
  audit: ScrollText,
  settings: Settings,
} as const;

export function AdminNav({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const pathname = usePathname();
  const base = `/${lang}/admin`;
  const items = [
    { key: "overview", href: base },
    { key: "stores", href: `${base}/stores` },
    { key: "orders", href: `${base}/orders` },
    { key: "users", href: `${base}/users` },
    { key: "types", href: `${base}/business-types` },
    { key: "market", href: `${base}/market` },
    { key: "delivery", href: `${base}/delivery` },
    { key: "reviews", href: `${base}/reviews` },
    { key: "verifications", href: `${base}/verifications` },
    { key: "leaders", href: `${base}/leaders` },
    { key: "subscriptions", href: `${base}/subscriptions` },
    { key: "reports", href: `${base}/reports` },
    { key: "audit", href: `${base}/audit` },
    { key: "settings", href: `${base}/settings` },
  ] as const;

  return (
    <div className="border-b border-border bg-background">
      <Container>
        <nav className="flex gap-1 overflow-x-auto py-2">
          {items.map((item) => {
            const Icon = icons[item.key];
            const active =
              item.href === base
                ? pathname === base || pathname === `${base}/`
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${
                  active
                    ? "bg-primary-soft text-primary"
                    : "text-muted-foreground hover:bg-surface-muted hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {dict.admin.nav[item.key]}
              </Link>
            );
          })}
        </nav>
      </Container>
    </div>
  );
}
