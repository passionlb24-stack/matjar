"use client";

import { Fragment } from "react";
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
  Briefcase,
  Palette,
  PackageOpen,
} from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { Container } from "@/components/ui/container";

const icons = {
  overview: LayoutGrid,
  stores: StoreIcon,
  orders: Receipt,
  market: ShoppingBag,
  delivery: Truck,
  jobs: Briefcase,
  freelance: Palette,
  wholesale: PackageOpen,
  leaders: Crown,
  reviews: Star,
  verifications: BadgeCheck,
  subscriptions: CreditCard,
  reports: BarChart3,
  users: Users,
  types: Tags,
  audit: ScrollText,
  settings: Settings,
} as const;

type NavKey = keyof typeof icons;

// Grouped so the panel stays legible as modules grow (10-year scale): each
// cluster is a labeled column, dividers between. Adding a module = one entry
// here, not a redesign.
const GROUPS: { key: string; items: { key: NavKey; path: string }[] }[] = [
  { key: "general", items: [{ key: "overview", path: "" }] },
  {
    key: "marketplace",
    items: [
      { key: "stores", path: "/stores" },
      { key: "orders", path: "/orders" },
      { key: "market", path: "/market" },
      { key: "delivery", path: "/delivery" },
    ],
  },
  {
    key: "community",
    items: [
      { key: "jobs", path: "/jobs" },
      { key: "freelance", path: "/freelance" },
      { key: "wholesale", path: "/wholesale" },
      { key: "leaders", path: "/leaders" },
    ],
  },
  {
    key: "trust",
    items: [
      { key: "reviews", path: "/reviews" },
      { key: "verifications", path: "/verifications" },
    ],
  },
  {
    key: "business",
    items: [
      { key: "subscriptions", path: "/subscriptions" },
      { key: "reports", path: "/reports" },
    ],
  },
  {
    key: "system",
    items: [
      { key: "users", path: "/users" },
      { key: "types", path: "/business-types" },
      { key: "audit", path: "/audit" },
      { key: "settings", path: "/settings" },
    ],
  },
];

export function AdminNav({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const pathname = usePathname();
  const base = `/${lang}/admin`;
  const groups = dict.admin.navGroups as Record<string, string>;

  return (
    <div className="border-b border-border bg-background">
      <Container>
        <nav className="flex items-stretch gap-2 overflow-x-auto py-2.5">
          {GROUPS.map((group, gi) => (
            <Fragment key={group.key}>
              {gi > 0 && (
                <div className="w-px shrink-0 self-stretch bg-border" />
              )}
              <div className="flex shrink-0 flex-col gap-1">
                <span className="px-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                  {groups[group.key]}
                </span>
                <div className="flex gap-1">
                  {group.items.map((item) => {
                    const href = `${base}${item.path}`;
                    const Icon = icons[item.key];
                    const active =
                      item.path === ""
                        ? pathname === base || pathname === `${base}/`
                        : pathname.startsWith(href);
                    return (
                      <Link
                        key={item.key}
                        href={href}
                        className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
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
                </div>
              </div>
            </Fragment>
          ))}
        </nav>
      </Container>
    </div>
  );
}
