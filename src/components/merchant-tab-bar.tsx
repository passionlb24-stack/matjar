"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, MoreHorizontal } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { CategoryKey } from "@/lib/catalog";
import {
  OS_MODULE_META,
  sectorTeamMeta,
  type OsModuleKey,
} from "@/lib/sectors";

export type MerchantTab = {
  key: OsModuleKey | "home" | "more";
  label: string;
  href?: string;
  badge?: number;
};

// The merchant's phone navigation.
//
// Until now a merchant on a phone got a 48px strip and a full-screen drawer:
// every check of "any new orders?" cost open drawer → find item → tap. A butcher
// between customers does not do that; they go back to the notebook.
//
// The tabs are derived from the store's own sector config rather than hardcoded
// per business type — a restaurant's second tab is الطلبات and a clinic's is
// المواعيد because their sector already declares which module leads. The drawer
// is not deleted; it moves behind المزيد, so nothing becomes unreachable.
export function MerchantTabBar({
  tabs,
  category,
  onMore,
  moreLabel,
}: {
  tabs: MerchantTab[];
  /** The store's sector — the roster module's glyph is sector-specific. */
  category: CategoryKey;
  /** Opens the existing sidebar drawer — overflow, not primary navigation. */
  onMore: () => void;
  moreLabel: string;
}) {
  const pathname = usePathname();

  const iconFor = (key: MerchantTab["key"]): LucideIcon =>
    key === "home"
      ? LayoutDashboard
      : key === "more"
        ? MoreHorizontal
        : key === "doctors"
          ? sectorTeamMeta(category).Icon
          : (OS_MODULE_META[key as OsModuleKey]?.Icon ?? LayoutDashboard);

  // The home tab matches only itself; a module tab matches its subtree, so an
  // order detail screen keeps العمليات lit rather than dropping the merchant's
  // sense of place.
  const isActive = (t: MerchantTab) => {
    if (!t.href) return false;
    if (t.key === "home") return pathname === t.href;
    return pathname === t.href || pathname.startsWith(`${t.href}/`);
  };

  return (
    <nav
      aria-label={moreLabel}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden print:hidden"
    >
      <ul className="flex items-stretch">
        {tabs.map((t) => {
          const Icon = iconFor(t.key);
          const active = isActive(t);
          const inner = (
            <>
              <span className="relative">
                <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 1.9} />
                {!!t.badge && t.badge > 0 && (
                  <span
                    aria-hidden
                    className="absolute -end-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-strong px-1 text-[10px] font-bold text-danger-strong-foreground tabular-nums"
                  >
                    {t.badge > 9 ? "9+" : t.badge}
                  </span>
                )}
              </span>
              {t.label}
            </>
          );
          const cls = `flex h-14 w-full flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors ${
            active ? "text-primary" : "text-muted-foreground"
          }`;

          return (
            <li key={t.key} className="flex-1">
              {t.href ? (
                <Link
                  href={t.href}
                  aria-current={active ? "page" : undefined}
                  aria-label={t.badge ? `${t.label} (${t.badge})` : undefined}
                  className={cls}
                >
                  {inner}
                </Link>
              ) : (
                <button type="button" onClick={onMore} className={cls}>
                  {inner}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
