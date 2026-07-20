"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  ExternalLink,
  LayoutDashboard,
  Lock,
  Menu,
  Store,
  X,
} from "lucide-react";
import type { Locale } from "@/i18n/config";
import { OS_MODULE_META, type OsModuleKey } from "@/lib/sectors";

// ===== Matjar Business OS — persistent sidebar =====
// The Shopify-grade shell around every store page. Desktop: a sticky rail on
// the inline-start side. Mobile: a slim top bar + slide-in drawer. The nav
// model arrives fully resolved (labels + hrefs) from the server layout; icons
// are looked up client-side by module key since component refs don't
// serialize across the RSC boundary.

export type SidebarItem = {
  key: string;
  label: string;
  href: string;
  /** Pro module on a free store — shows a lock (pages still re-gate). */
  locked?: boolean;
  /** Match this href exactly (the OS home must not stay lit on subpages). */
  exact?: boolean;
};

export type SidebarNav = {
  home: SidebarItem;
  groups: { key: string; label: string; items: SidebarItem[] }[];
  pinned: SidebarItem[];
  backLabel: string;
  viewStoreLabel: string;
  proBadge: string;
  freeBadge: string;
};

function ItemIcon({
  itemKey,
  className,
}: {
  itemKey: string;
  className?: string;
}) {
  const Icon =
    itemKey === "home"
      ? LayoutDashboard
      : (OS_MODULE_META[itemKey as OsModuleKey]?.Icon ?? LayoutDashboard);
  return <Icon className={className} aria-hidden />;
}

function NavRow({
  item,
  active,
  onNavigate,
}: {
  item: SidebarItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`relative flex h-9 items-center gap-2.5 rounded-lg px-3 text-sm transition-colors active:scale-[0.98] ${
        active
          ? "bg-primary-soft font-bold text-primary"
          : "font-medium text-muted-foreground hover:bg-surface-muted hover:text-foreground"
      }`}
    >
      {active && (
        <span
          aria-hidden
          className="absolute inset-y-1.5 start-0 w-[3px] rounded-full bg-primary"
        />
      )}
      <ItemIcon itemKey={item.key} className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.locked && (
        <Lock className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden />
      )}
    </Link>
  );
}

export function MerchantSidebar({
  lang,
  storeId,
  storeName,
  logoUrl,
  plan,
  slug,
  nav,
}: {
  lang: Locale;
  storeId: string;
  storeName: string;
  logoUrl: string | null;
  plan: "free" | "pro";
  slug: string | null;
  nav: SidebarNav;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  const viewHref = `/${lang}/${slug ?? `store/${storeId}`}`;

  // Longest-prefix active matching; the home item opts into exact-only so it
  // doesn't stay lit for every subpage under the store base path.
  const activeHref = useMemo(() => {
    const all = [nav.home, ...nav.groups.flatMap((g) => g.items), ...nav.pinned];
    let best: SidebarItem | null = null;
    for (const item of all) {
      const match = item.exact
        ? pathname === item.href
        : pathname === item.href || pathname.startsWith(`${item.href}/`);
      if (match && (!best || item.href.length > best.href.length)) best = item;
    }
    return best?.href ?? null;
  }, [pathname, nav]);

  // Drawer lifecycle: close on route change, close on Escape, focus the close
  // button when opening (basic trap), lock body scroll while open.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  const identity = (
    <div className="flex items-center gap-3 border-b border-border px-4 py-4">
      {logoUrl ? (
        <Image
          src={logoUrl}
          alt=""
          width={36}
          height={36}
          className="h-9 w-9 shrink-0 rounded-lg border border-border bg-surface object-cover"
        />
      ) : (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-sm font-extrabold text-primary">
          {storeName.trim().charAt(0)}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold">{storeName}</div>
        <div className="mt-0.5 flex items-center gap-1.5">
          <span
            className={`rounded-full px-1.5 py-px text-[10px] font-bold ${
              plan === "pro"
                ? "bg-accent-soft text-accent-foreground"
                : "bg-surface-muted text-muted-foreground"
            }`}
          >
            {plan === "pro" ? nav.proBadge : nav.freeBadge}
          </span>
          <Link
            href={viewHref}
            target="_blank"
            aria-label={nav.viewStoreLabel}
            title={nav.viewStoreLabel}
            className="text-muted-foreground transition-colors hover:text-primary"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </div>
    </div>
  );

  const navContent = (
    <>
      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <NavRow
          item={nav.home}
          active={activeHref === nav.home.href}
          onNavigate={() => setOpen(false)}
        />
        {nav.groups.map((group) => (
          <div key={group.key} className="mt-6">
            <div className="ps-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">
              {group.label}
            </div>
            <div className="mt-1.5 space-y-0.5">
              {group.items.map((item) => (
                <NavRow
                  key={item.key}
                  item={item}
                  active={activeHref === item.href}
                  onNavigate={() => setOpen(false)}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="space-y-0.5 border-t border-border px-3 py-3">
        {nav.pinned.map((item) => (
          <NavRow
            key={item.key}
            item={item}
            active={activeHref === item.href}
            onNavigate={() => setOpen(false)}
          />
        ))}
        <Link
          href={`/${lang}/merchant`}
          onClick={() => setOpen(false)}
          className="flex h-9 items-center gap-2.5 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground active:scale-[0.98]"
        >
          <Store className="h-4 w-4 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1 truncate">{nav.backLabel}</span>
        </Link>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop rail — sticks below the h-16 dashboard header. */}
      <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] w-60 shrink-0 flex-col border-e border-border bg-surface lg:flex print:hidden">
        {identity}
        {navContent}
      </aside>

      {/* Mobile top bar. */}
      <div className="sticky top-16 z-30 flex h-12 items-center gap-2 border-b border-border bg-surface/90 px-4 backdrop-blur lg:hidden print:hidden">
        <button
          type="button"
          aria-label="menu"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          className="-ms-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-surface-muted active:scale-[0.98]"
        >
          <Menu className="h-5 w-5" aria-hidden />
        </button>
        <span className="min-w-0 flex-1 truncate text-sm font-bold">
          {storeName}
        </span>
        <Link
          href={viewHref}
          target="_blank"
          aria-label={nav.viewStoreLabel}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground active:scale-[0.98]"
        >
          <ExternalLink className="h-4 w-4" aria-hidden />
        </Link>
      </div>

      {/* Mobile drawer — always mounted so it can slide, inert when closed. */}
      <div
        className={`fixed inset-0 z-50 lg:hidden ${open ? "" : "pointer-events-none"}`}
        aria-hidden={!open}
      >
        <div
          className={`absolute inset-0 bg-black/30 transition-opacity duration-200 motion-reduce:transition-none ${
            open ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setOpen(false)}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label={storeName}
          className={`absolute inset-y-0 start-0 flex w-72 max-w-[85vw] flex-col bg-surface shadow-xl transition-transform duration-200 ease-out motion-reduce:transition-none ${
            open
              ? "translate-x-0"
              : "ltr:-translate-x-full rtl:translate-x-full"
          }`}
        >
          <div className="relative">
            {identity}
            <button
              ref={closeRef}
              type="button"
              aria-label="close"
              onClick={() => setOpen(false)}
              className="absolute end-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
          {navContent}
        </div>
      </div>
    </>
  );
}
