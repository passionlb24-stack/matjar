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

// ===== The merchant's thumb navigation =====
//
// A merchant runs this shop from behind a counter, one-handed, with a customer
// waiting. The three things they do all day are: see a new order arrived,
// accept it, and mark an item that just ran out. None of those should cost
// "open drawer → scan 30 rows → tap".
//
// Five slots, fixed, in this order: home · operations · catalogue · customers ·
// more. Only the labels of the middle three are sector-resolved, because the
// sector registry — not this component — owns what the shop's own words are: a
// clinic's operations tab is المواعيد and its customers tab is المرضى. A
// restaurant's is الطلبات. Hardcoding "الطلبات · منتجاتي · زبائني" here would
// have printed "منتجاتي" over a hotel's room list and "زبائني" over a clinic's
// patients, which is the kind of wrongness that makes a merchant distrust the
// whole screen.
//
// المزيد opens the existing sidebar drawer, which is the full, permission- and
// plan-filtered module list. Nothing becomes unreachable; the drawer just stops
// being how orders are reached.

export type MerchantNavItem = {
  /** Slot identity — decides the glyph and the active-match rule. */
  key: OsModuleKey | "home" | "more";
  label: string;
  /** Absent on المزيد, which is a button rather than a link. */
  href?: string;
  /** Real count of things awaiting the merchant. Never decorative. */
  badge?: number;
};

export function MerchantBottomNav({
  items,
  category,
  onMore,
  navLabel,
}: {
  items: MerchantNavItem[];
  /** The store's sector — the roster module's glyph is sector-specific. */
  category: CategoryKey;
  /** Opens the sidebar drawer: overflow, not primary navigation. */
  onMore: () => void;
  /** Accessible name for the <nav> landmark. */
  navLabel: string;
}) {
  const pathname = usePathname();

  const iconFor = (key: MerchantNavItem["key"]): LucideIcon =>
    key === "home"
      ? LayoutDashboard
      : key === "more"
        ? MoreHorizontal
        : // The roster module's key is `doctors` everywhere (table, route, RPC)
          // but only a clinic's roster is doctors — the sector picks the glyph.
          key === "doctors"
          ? sectorTeamMeta(category).Icon
          : (OS_MODULE_META[key as OsModuleKey]?.Icon ?? LayoutDashboard);

  // Home matches only itself; a module tab matches its whole subtree, so an
  // order's invoice screen keeps الطلبات lit instead of dropping the merchant's
  // sense of where they are.
  const isActive = (t: MerchantNavItem) => {
    if (!t.href) return false;
    if (t.key === "home") return pathname === t.href;
    return pathname === t.href || pathname.startsWith(`${t.href}/`);
  };

  return (
    // Below lg only — from lg the sidebar rail is the navigation and this would
    // be a second copy of it eating 56px of a desktop viewport.
    <nav
      aria-label={navLabel}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden print:hidden"
    >
      <ul className="flex items-stretch">
        {items.map((t) => {
          const Icon = iconFor(t.key);
          const active = isActive(t);
          const badge = t.badge ?? 0;
          const inner = (
            <>
              <span className="relative">
                <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 1.9} />
                {badge > 0 && (
                  <span
                    aria-hidden
                    className="absolute -end-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-strong px-1 text-[10px] font-bold text-danger-strong-foreground tabular-nums"
                  >
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
              </span>
              {/* min-w-0 + truncate: five labels across a 320px viewport give
                  each tab 64px, and a long sector label (الحجوزات، المرضى)
                  must clip rather than widen the row into a scrollbar. */}
              <span className="w-full min-w-0 truncate px-0.5 text-center">
                {t.label}
              </span>
            </>
          );
          // h-14 = 56px tall and ≥64px wide per tab: the whole cell is the
          // target, so there is nothing under 44px to grow with a pseudo.
          const cls = `flex h-14 w-full flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors ${
            active ? "text-primary" : "text-muted-foreground"
          }`;

          return (
            <li key={t.key} className="min-w-0 flex-1">
              {t.href ? (
                <Link
                  href={t.href}
                  aria-current={active ? "page" : undefined}
                  aria-label={badge > 0 ? `${t.label} (${badge})` : undefined}
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
