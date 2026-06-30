"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  Store as StoreIcon,
  Users,
  Tags,
  BarChart3,
} from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { Container } from "@/components/ui/container";

const icons = {
  overview: LayoutGrid,
  stores: StoreIcon,
  users: Users,
  types: Tags,
  reports: BarChart3,
} as const;

export function AdminNav({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const pathname = usePathname();
  const base = `/${lang}/admin`;
  const items = [
    { key: "overview", href: base },
    { key: "stores", href: `${base}/stores` },
    { key: "users", href: `${base}/users` },
    { key: "types", href: `${base}/business-types` },
    { key: "reports", href: `${base}/reports` },
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
