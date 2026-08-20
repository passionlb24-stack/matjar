"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingCart, MessageCircle, Zap } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { categoryStyles, type CategoryKey } from "@/lib/catalog";
import { attributeSummary, categoryAttributes } from "@/lib/attributes";
import { effectivePrice, compareAtPrice, isFlashActive } from "@/lib/pricing";
import { waLink, buildOrderMessage } from "@/lib/whatsapp";
import { formatUsd } from "@/lib/currency";
import {
  unitPricingOf,
  pricePerBase,
  baseMeasure,
  isWholeBaseUnit,
  formatQuantityMeasure,
  MEASURE_LABELS,
  type UnitPricing,
} from "@/lib/unit-pricing";
import { deliveryWindows, scheduledForIso } from "@/lib/delivery-windows";
import type { WeekHours } from "@/lib/hours";
import { localized } from "@/lib/i18n-field";
import { groupBySection, type SectionInfo } from "@/lib/sections";
import { categoryIcons } from "@/components/category-icon";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import {
  CheckoutForm,
  type PlacedOrder,
} from "@/components/checkout/checkout-form";
import { OrderPlaced } from "@/components/checkout/order-placed";
import { newIdempotencyKey } from "@/lib/checkout";
import type {
  CheckoutItem,
  CheckoutLine,
  CheckoutViewer,
  StoreCheckout,
} from "@/lib/checkout";

// Delivery zone (migration 0172). The type now lives with the rest of the
// checkout contract in src/lib/checkout.ts — re-exported here only so the
// existing importers (store-products-section, the store page) keep working.
export type { DeliveryZone } from "@/lib/checkout";

type Product = {
  id: string;
  name: string;
  nameEn?: string | null;
  brand?: string | null;
  price: number;
  discountPrice?: number | null;
  imageUrl?: string | null;
  attributes?: Record<string, string> | null;
  flashPrice?: number | null;
  flashStart?: string | null;
  flashEnd?: string | null;
  stock?: number | null;
  sectionId?: string | null;
  /**
   * Has variants, so it must not be quick-added. `cart` is keyed by product id
   * alone and every p_items entry it builds omits variant_id — the server would
   * charge the base price and decrement products.stock, while the price and the
   * stock that matter both live on the variant. These go to the product page,
   * which has the picker.
   */
  hasVariants?: boolean;
  isBundle?: boolean;
  includes?: { name: string; nameEn: string | null; quantity: number }[];
  /** 0299. Null on every product that predates it. */
  soldBy?: string | null;
  unitMeasure?: string | null;
  unitAmount?: number | null;
};

/**
 * "/ كيلو" after the price, and the per-kilo rate when a unit is not a whole
 * one.
 *
 * This is the fix MJ-010 is actually about. The butcher's cards read "$7.50"
 * today, and $7.50 is what he charges for a KILO of minced beef — the unit was
 * never anywhere on the screen, in the database or in the order. Nothing about
 * the money changes here; the unit that was always implied is simply printed.
 *
 * For a unit that is not one whole kilo (say 250 g at $1.88) both are shown:
 * what you pay for one unit, and what that works out to per kilo. The second is
 * the number a shopper compares against the shop down the road, and deriving it
 * for them is the difference between an honest price and an arithmetic puzzle.
 */
function UnitSuffix({
  unit,
  unitPrice,
  lang,
}: {
  unit: UnitPricing;
  unitPrice: number;
  lang: Locale;
}) {
  const l = lang === "ar" ? "ar" : "en";
  const per = MEASURE_LABELS[unit.measure][l];
  if (isWholeBaseUnit(unit)) {
    return (
      <span className="text-xs font-semibold text-muted-foreground">
        {" / "}
        {per}
      </span>
    );
  }
  const base = baseMeasure(unit);
  return (
    <>
      <span className="text-xs font-semibold text-muted-foreground">
        {" / "}
        {formatQuantityMeasure(unit, 1, l)}
      </span>
      <span className="text-xs font-normal text-muted-foreground">
        {"· "}
        <span className="text-money">{formatUsd(pricePerBase(unitPrice, unit))}</span>
        {` / ${MEASURE_LABELS[base][l]}`}
      </span>
    </>
  );
}

function PriceTag({ p, lang }: { p: Product; lang: Locale }) {
  const eff = effectivePrice(p);
  const compare = compareAtPrice(p);
  const flash = isFlashActive(p);
  const unit = unitPricingOf(p);
  return (
    <span className="sf-price inline-flex flex-wrap items-center gap-x-1.5">
      {/* .text-money = tabular numerals + LTR bidi isolation, the house rule
          for currency inside Arabic text (globals.css). */}
      <span
        className={`text-money font-bold ${flash ? "text-warning" : "text-primary"}`}
      >
        {formatUsd(eff)}
      </span>
      {/* The unit rides immediately after the amount, before the struck-through
          compare-at price, so "$5 / كيلو  $6" reads as one price and its old
          value rather than as two prices with a unit between them. */}
      {unit && <UnitSuffix unit={unit} unitPrice={eff} lang={lang} />}
      {compare != null && (
        <span className="text-money text-xs font-normal text-muted-foreground line-through">
          {formatUsd(compare)}
        </span>
      )}
      {flash && <Zap className="h-3.5 w-3.5 fill-accent text-accent" />}
    </span>
  );
}

// "يشمل: 2× X · 1× Y" under a bundle's name so shoppers see what's inside.
function BundleIncludes({
  p,
  lang,
  label,
}: {
  p: Product;
  lang: Locale;
  label: string;
}) {
  if (!p.isBundle || !p.includes?.length) return null;
  return (
    <p className="mt-0.5 text-xs text-muted-foreground">
      <span className="font-semibold text-primary">{label} </span>
      {p.includes
        .map((it) => `${it.quantity}× ${localized(it.name, it.nameEn, lang)}`)
        .join(" · ")}
    </p>
  );
}

const GRID_CATEGORIES = new Set<CategoryKey>([
  "retail",
  "realEstate",
  "automotive",
]);

export function StoreProducts({
  lang,
  dict,
  category,
  isBooking,
  products,
  checkout,
  viewer,
  lbpRate = 0,
  sections = [],
  layout = null,
  initialBrand = null,
  hours = null,
}: {
  lang: Locale;
  dict: Dictionary;
  category: CategoryKey;
  isBooking: boolean;
  products: Product[];
  /** What this store's checkout offers — zones, coupons, loyalty, the
   *  merchant's own questions. One object rather than fifteen loose props, so
   *  a surface cannot be handed half of a checkout (MJ-024). */
  checkout: StoreCheckout;
  /** The per-customer half: signed in, saved addresses. */
  viewer: CheckoutViewer;
  lbpRate?: number;
  layout?: "grid" | "menu" | "showcase" | null;
  initialBrand?: string | null;
  sections?: SectionInfo[];
  /** The store's own opening hours (stores.hours). The delivery-window picker
   *  is derived from these and hidden entirely when the merchant has not set
   *  any — see src/lib/delivery-windows.ts. */
  hours?: WeekHours | null;
}) {
  const router = useRouter();
  const storeId = checkout.storeId;
  const [cart, setCart] = useState<Record<string, number>>({});
  const cartKey = `matjar-cart-${storeId}`;

  // Persist the cart per store so a refresh / accidental navigation doesn't
  // wipe it (a common drop-off point). Loaded on mount to avoid SSR mismatch.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const saved = localStorage.getItem(cartKey);
      if (saved) setCart(JSON.parse(saved));
    } catch {
      /* ignore corrupt storage */
    }
  }, [cartKey]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    try {
      if (Object.keys(cart).length) {
        localStorage.setItem(cartKey, JSON.stringify(cart));
      } else {
        localStorage.removeItem(cartKey);
      }
    } catch {
      /* ignore */
    }
  }, [cart, cartKey]);

  const [checkingOut, setCheckingOut] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  // Delivery window. Empty = order now, which is what every order has been
  // until this existed, so leaving it alone changes nothing.
  const [windowDate, setWindowDate] = useState("");
  const [windowTime, setWindowTime] = useState("");
  // The clock is read AFTER mount, never during render.
  //
  // This component is a client component but it is still server-rendered, and
  // `deliveryWindows(hours, new Date())` in the render body would be evaluated
  // twice against two different clocks in two different zones: on the server
  // (UTC on Vercel) and again in the browser (UTC+3 in Beirut). `daySpan` keys
  // off `getDay()` and the dates are built from local parts, so the two runs
  // can disagree about which slots exist and even about which DAY it is —
  // a hydration mismatch on the money path. Same reason the cart above reads
  // localStorage in an effect rather than during render.
  const [now, setNow] = useState<Date | null>(null);
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setNow(new Date());
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  // Null until mounted, so the server renders no picker at all rather than one
  // built from the wrong timezone. The server re-checks and drops a past time
  // regardless (0194), so a list that ages while the customer types is safe.
  const windows = now ? deliveryWindows(hours, now) : [];
  const daySlots = windows.find((w) => w.date === windowDate)?.slots ?? [];
  // A day without a time is not a window: it sends nothing, and the order is an
  // ordinary order-now.
  const scheduledFor = scheduledForIso(windowDate, windowTime);
  // One idempotency key per checkout ATTEMPT — re-minted every time the
  // customer enters the checkout, so a basket they edited and re-confirmed is
  // a new order rather than the RPC handing back the earlier one.
  const [attemptKey, setAttemptKey] = useState(newIdempotencyKey);
  // The placed order, frozen at success: the cart is cleared on the very next
  // line, and everything the confirmation screen shows — the total, the
  // WhatsApp message — is derived from the cart.
  const [placed, setPlaced] = useState<PlacedOrder | null>(null);

  // Listing filters (realEstate/automotive): buyers narrow the grid by the
  // sector's filterable attributes (purpose, rooms, gearbox, fuel…). Only fields
  // marked filter:true, and only when some product actually carries a value.
  const [attrFilters, setAttrFilters] = useState<Record<string, string>>({});
  const filterFields = (categoryAttributes[category] ?? []).filter(
    (f) => f.filter,
  );

  // Brand filter (Salla parity): distinct brands present in the catalogue. A
  // brand link from a product page arrives via ?brand= as initialBrand.
  const brands = [
    ...new Set(
      products.map((p) => p.brand?.trim()).filter((b): b is string => !!b),
    ),
  ].sort((a, b) => a.localeCompare(b));
  const [brand, setBrand] = useState<string | null>(
    initialBrand && brands.includes(initialBrand) ? initialBrand : null,
  );

  const Icon = categoryIcons[category];
  const style = categoryStyles[category];
  // Layout: the merchant's chosen template overrides the sector default. "menu"
  // is the compact row list; "grid"/"showcase" are both image-top card grids
  // (showcase = fewer, larger cards).
  const effectiveLayout =
    layout ?? (GRID_CATEGORIES.has(category) ? "grid" : "menu");
  const isRow = effectiveLayout === "menu";
  const isShowcase = effectiveLayout === "showcase";
  const isGrid = !isRow; // image-top card (grid or showcase) vs. row list
  const addLabel = isBooking ? dict.store.book : dict.store.order;

  function setQty(id: string, qty: number) {
    // Never let the cart exceed tracked stock — overselling is also caught
    // server-side, but capping here keeps the UI honest.
    const p = products.find((x) => x.id === id);
    const max = p?.stock != null ? p.stock : Infinity;
    const clamped = Math.min(qty, max);
    setCart((c) => {
      const next = { ...c };
      if (clamped <= 0) delete next[id];
      else next[id] = clamped;
      return next;
    });
  }

  const items = products.filter((p) => (cart[p.id] ?? 0) > 0);
  const total = items.reduce(
    (sum, p) => sum + effectivePrice(p) * cart[p.id],
    0,
  );
  // The basket, in the two shapes a checkout needs: what the customer reads,
  // and what the RPC is sent. Both are derived from the same `items`, so a line
  // cannot appear on the summary and be missing from the order.
  const lines: CheckoutLine[] = items.map((p) => ({
    id: p.id,
    name: p.name,
    quantity: cart[p.id],
    unitPrice: effectivePrice(p),
  }));
  // No variant_id / addon_ids here on purpose: the grid quick-adds only
  // variant-less products (`hasVariants` sends the rest to the product page,
  // which has the picker), so there is nothing to send. The product page fills
  // those in on the same CheckoutItem shape.
  const orderItems: CheckoutItem[] = items.map((p) => ({
    product_id: p.id,
    quantity: cart[p.id],
  }));

  // The WhatsApp fallback on the sticky bar — an order the customer sends the
  // merchant directly instead of placing one here. Uses the pre-discount
  // subtotal because no discount has been chosen at that point.
  const waUrl =
    checkout.whatsapp && items.length
      ? waLink(
          checkout.whatsapp,
          buildOrderMessage({
            greeting: dict.store.waGreeting,
            storeName: checkout.storeName,
            lines: items.map((p) => ({
              name: p.name,
              qty: cart[p.id],
              lineTotal: formatUsd(effectivePrice(p) * cart[p.id]),
            })),
            totalLabel: dict.store.total,
            total: formatUsd(total),
            address: viewer.defaultAddress || null,
          }),
        )
      : null;

  function startCheckout() {
    setAttemptKey(newIdempotencyKey());
    setCheckingOut(true);
  }

  function onPlaced(order: PlacedOrder) {
    setCheckingOut(false);
    setPlaced(order);
    setCart({}); // clears the persisted cart via the storage effect
    router.refresh();
  }

  function Stepper({ id, qty }: { id: string; qty: number }) {
    const p = products.find((x) => x.id === id);
    const atMax = p?.stock != null && qty >= p.stock;
    // A weight-sold line counts in kilos, not in nameless units. The stepper
    // still increments the same integer `quantity` the RPC receives — only the
    // label between the buttons changes, from "2" to "2 كيلو". Rendered LTR
    // with tabular figures for the same bidi reason money is: "500 غ" inside an
    // RTL row otherwise resolves its number and its unit against each other.
    const unit = p ? unitPricingOf(p) : null;
    const readout = unit
      ? formatQuantityMeasure(unit, qty, lang === "ar" ? "ar" : "en")
      : String(qty);
    return (
      <div className="flex items-center gap-2">
        {/* 32px squares are what the design wants and 44px is what a thumb
            needs, so the hit area is extended with a transparent pseudo-element
            rather than growing the buttons. These are the most-tapped controls
            in the whole shopping flow. */}
        <button
          onClick={() => setQty(id, qty - 1)}
          className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-border transition-colors before:absolute before:-inset-1.5 before:content-[''] hover:bg-surface-muted"
          aria-label="-"
        >
          <Minus className="h-4 w-4" />
        </button>
        <span
          dir="ltr"
          className={`text-center font-bold tabular-nums ${unit ? "min-w-16" : "w-5"}`}
        >
          {readout}
        </span>
        <button
          onClick={() => setQty(id, qty + 1)}
          disabled={atMax}
          className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-border transition-colors before:absolute before:-inset-1.5 before:content-[''] hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="+"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    );
  }

  function Card({ p }: { p: Product }) {
    return p.imageUrl ? (
      <Image
        src={p.imageUrl}
        alt={localized(p.name, p.nameEn, lang)}
        width={isGrid ? 400 : 64}
        height={isGrid ? (isShowcase ? 300 : 200) : 64}
        className={
          isGrid
            ? `${isShowcase ? "h-56" : "h-40"} w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]`
            : "h-16 w-16 shrink-0 rounded-xl object-cover"
        }
        sizes={isGrid ? "(max-width: 640px) 100vw, 50vw" : "64px"}
      />
    ) : (
      <div
        className={`flex items-center justify-center bg-gradient-to-br ${style.cover} ${isGrid ? `${isShowcase ? "h-56" : "h-40"} w-full` : "h-16 w-16 shrink-0 rounded-xl"}`}
      >
        <Icon
          className={
            isGrid ? "h-10 w-10 text-foreground/20" : "h-7 w-7 text-foreground/20"
          }
        />
      </div>
    );
  }

  // Render one arbitrary subset of products (a section's items, or the whole
  // flat catalog). Keeps the per-category grid/list styling; grouping only
  // decides which products land in which call.
  function renderList(list: Product[]) {
    return isGrid ? (
      <div
        className={
          isShowcase
            ? "grid grid-cols-1 gap-5 sm:grid-cols-2"
            : "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
        }
      >
        {list.map((p) => {
          const qty = cart[p.id] ?? 0;
          return (
            <div
              key={p.id}
              className="sf-card group flex flex-col overflow-hidden rounded-2xl border border-border bg-surface transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
            >
              <Card p={p} />
              <div className="flex flex-1 flex-col p-4">
                <Link
                  href={`/${lang}/product/${p.id}`}
                  dir="auto"
                  className="font-bold leading-tight transition-colors hover:text-primary"
                >
                  {localized(p.name, p.nameEn, lang)}
                </Link>
                {attributeSummary(category, p.attributes, lang) && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {attributeSummary(category, p.attributes, lang)}
                  </p>
                )}
                <BundleIncludes
                  p={p}
                  lang={lang}
                  label={dict.store.bundleIncludes}
                />
                <p className="mt-1">
                  <PriceTag p={p} lang={lang} />
                </p>
                {p.stock != null && p.stock > 0 && p.stock <= 5 && (
                  <p className="mt-1 text-xs font-bold text-warning">
                    {dict.store.onlyLeft.replace("{n}", String(p.stock))}
                  </p>
                )}
                <div className="mt-3 flex justify-end">
                  {p.stock != null && p.stock <= 0 ? (
                    <span className="w-full rounded-lg bg-surface-muted px-3.5 py-2 text-center text-sm font-bold text-muted-foreground">
                      {dict.store.soldOut}
                    </span>
                  ) : p.hasVariants ? (
                    <Link
                      href={`/${lang}/product/${p.id}`}
                      className="w-full rounded-lg bg-primary px-3.5 py-2 text-center text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
                    >
                      {dict.store.chooseOption}
                    </Link>
                  ) : qty > 0 ? (
                    <Stepper id={p.id} qty={qty} />
                  ) : (
                    <button
                      onClick={() => setQty(p.id, 1)}
                      className="w-full rounded-lg bg-primary px-3.5 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
                    >
                      {addLabel}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    ) : (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {list.map((p) => {
          const qty = cart[p.id] ?? 0;
          return (
            <div
              key={p.id}
              className="sf-card flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
            >
              <Card p={p} />
              <div className="min-w-0 flex-1">
                <Link
                  href={`/${lang}/product/${p.id}`}
                  dir="auto"
                  className="block truncate font-bold transition-colors hover:text-primary"
                >
                  {localized(p.name, p.nameEn, lang)}
                </Link>
                {attributeSummary(category, p.attributes, lang) && (
                  <p className="truncate text-xs text-muted-foreground">
                    {attributeSummary(category, p.attributes, lang)}
                  </p>
                )}
                <BundleIncludes
                  p={p}
                  lang={lang}
                  label={dict.store.bundleIncludes}
                />
                <p className="mt-0.5 text-sm">
                  <PriceTag p={p} lang={lang} />
                  {p.stock != null && p.stock > 0 && p.stock <= 5 && (
                    <span className="ms-2 text-xs font-bold text-warning">
                      {dict.store.onlyLeft.replace("{n}", String(p.stock))}
                    </span>
                  )}
                </p>
              </div>
              {p.stock != null && p.stock <= 0 ? (
                <span className="shrink-0 rounded-lg bg-surface-muted px-3.5 py-2 text-sm font-bold text-muted-foreground">
                  {dict.store.soldOut}
                </span>
              ) : p.hasVariants ? (
                <Link
                  href={`/${lang}/product/${p.id}`}
                  className="shrink-0 rounded-lg bg-primary px-3.5 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
                >
                  {dict.store.chooseOption}
                </Link>
              ) : qty > 0 ? (
                <Stepper id={p.id} qty={qty} />
              ) : (
                <button
                  onClick={() => setQty(p.id, 1)}
                  className="shrink-0 rounded-lg bg-primary px-3.5 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
                >
                  {addLabel}
                </button>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // Per-field selectable values: select fields use their fixed options; text/
  // number fields (brand, rooms) derive distinct values actually present.
  function fieldChoices(f: (typeof filterFields)[number]) {
    if (f.type === "select") return f.options ?? [];
    const seen = new Map<string, string>();
    for (const p of products) {
      const v = p.attributes?.[f.key];
      if (v && !seen.has(v)) seen.set(v, v);
    }
    return [...seen.keys()]
      .sort((a, b) =>
        f.type === "number" ? Number(a) - Number(b) : a.localeCompare(b),
      )
      .map((v) => ({ value: v, ar: v, en: v }));
  }

  const activeFilters = Object.entries(attrFilters).filter(([, v]) => v);
  const filteredProducts = products.filter((p) => {
    if (brand && (p.brand?.trim() ?? "") !== brand) return false;
    return activeFilters.every(([k, v]) => (p.attributes?.[k] ?? "") === v);
  });

  // Only worth showing when this sector has filterable fields with real values.
  const shownFilterFields = filterFields.filter(
    (f) => fieldChoices(f).length > 0,
  );

  // Group for display when the store defined sections; otherwise one flat list
  // (no headers, no regression). Cart/total logic still uses the full `products`.
  const groups = groupBySection(filteredProducts, sections);

  return (
    <div>
      {brands.length > 1 && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setBrand(null)}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-bold transition-colors ${
              brand === null
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:border-primary/40"
            }`}
          >
            {dict.store.allBrands}
          </button>
          {brands.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBrand(b)}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-bold transition-colors ${
                brand === b
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:border-primary/40"
              }`}
            >
              {b}
            </button>
          ))}
        </div>
      )}
      {isGrid && shownFilterFields.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          {shownFilterFields.map((f) => (
            <select
              key={f.key}
              value={attrFilters[f.key] ?? ""}
              onChange={(e) =>
                setAttrFilters((s) => ({ ...s, [f.key]: e.target.value }))
              }
              className="rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm font-semibold outline-none transition-colors focus:border-primary"
            >
              <option value="">{lang === "ar" ? f.ar : f.en}</option>
              {fieldChoices(f).map((o) => (
                <option key={o.value} value={o.value}>
                  {lang === "ar" ? o.ar : o.en}
                </option>
              ))}
            </select>
          ))}
          {activeFilters.length > 0 && (
            <button
              type="button"
              onClick={() => setAttrFilters({})}
              className="rounded-full px-3 py-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              {dict.store.clearFilters}
            </button>
          )}
        </div>
      )}

      {(brand || (isGrid && shownFilterFields.length > 0)) &&
      filteredProducts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          {dict.store.noMatches}
        </div>
      ) : sections.length > 0 ? (
        <div className="space-y-8">
          {groups.map((g) => (
            <section key={g.section?.id ?? "__other"}>
              <h3 className="mb-4 text-lg font-bold">
                {g.section
                  ? localized(g.section.name, g.section.nameEn, lang)
                  : dict.store.otherSection}
              </h3>
              {renderList(g.items)}
            </section>
          ))}
        </div>
      ) : (
        renderList(filteredProducts)
      )}

      {placed ? (
        <OrderPlaced
          lang={lang}
          dict={dict}
          order={placed}
          loggedIn={viewer.loggedIn}
        />
      ) : (
        items.length > 0 && (
          <>
            {/* Hidden rather than unmounted while the customer is back in the
                cart: an applied coupon, a chosen zone and a typed address are
                answers they already gave, and losing them on "edit order" is
                losing a discount they had earned. */}
            <div
              hidden={!checkingOut}
              className="mt-6 rounded-2xl border border-border bg-surface p-5 shadow-sm"
            >
              {/* Delivery window. Derived from stores.hours, so the only times
                  offered are times this shop is actually open — the existing
                  picker on the product page is a bare datetime-local that will
                  cheerfully take 3am. Hidden altogether when the merchant has
                  set no hours: a picker with nothing safe to offer is worse
                  than none. Rides to the server inside p_custom_fields, which
                  is the channel 0194 already reads — no schema, no RPC change,
                  and "order now" stays the default. */}
              {windows.length > 0 && (
                <div className="mb-5">
                  <span className="text-sm font-semibold">
                    {dict.store.windowTitle}
                  </span>
                  <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
                    <select
                      aria-label={dict.store.windowTitle}
                      value={windowDate}
                      onChange={(e) => {
                        setWindowDate(e.target.value);
                        setWindowTime("");
                      }}
                      className="h-11 rounded-xl border border-border bg-surface px-3 text-sm font-semibold outline-none transition-colors focus:border-primary"
                    >
                      <option value="">{dict.store.windowAsap}</option>
                      {windows.map((w, i) => (
                        <option key={w.date} value={w.date}>
                          {i === 0
                            ? dict.store.windowToday
                            : i === 1
                              ? dict.store.windowTomorrow
                              : new Date(`${w.date}T12:00`).toLocaleDateString(
                                  lang === "ar" ? "ar-LB" : "en-GB",
                                  { weekday: "long", day: "numeric", month: "short" },
                                )}
                        </option>
                      ))}
                    </select>
                    {windowDate && (
                      <select
                        aria-label={dict.store.windowTime}
                        dir="ltr"
                        value={windowTime}
                        onChange={(e) => setWindowTime(e.target.value)}
                        className="h-11 rounded-xl border border-border bg-surface px-3 text-sm font-semibold tabular-nums outline-none transition-colors focus:border-primary"
                      >
                        <option value="">{dict.store.windowTime}</option>
                        {daySlots.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {dict.store.windowHint}
                  </p>
                </div>
              )}
              <CheckoutForm
                lang={lang}
                dict={dict}
                store={checkout}
                viewer={viewer}
                lines={lines}
                items={orderItems}
                idempotencyKey={attemptKey}
                lbpRate={lbpRate}
                onBack={() => setCheckingOut(false)}
                onPlaced={onPlaced}
                onRemoveLine={(id) => setQty(id, 0)}
                extraCustomFields={
                  scheduledFor ? { scheduled_for: scheduledFor } : undefined
                }
              />
            </div>
            {!checkingOut && (
          <div className="sticky bottom-4 mt-6 flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-4 shadow-lg">
            {/* The bar used to state a total for a list the customer could no
                longer see without committing to checkout. Tapping it now opens
                the cart itself. */}
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="min-w-0 text-start"
            >
              <p aria-live="polite" className="text-sm text-muted-foreground">
                {dict.store.itemsInCart.replace(
                  "{n}",
                  String(items.reduce((n, p) => n + cart[p.id], 0)),
                )}
              </p>
              <p key={total} className="animate-pop text-lg font-extrabold tabular-nums">
                {formatUsd(total)}
              </p>
            </button>
            <div className="flex items-center gap-2">
              {waUrl && (
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants({ variant: "whatsapp" })}
                >
                  <MessageCircle className="h-4 w-4" />
                  <span className="hidden sm:inline">
                    {dict.store.orderWhatsapp}
                  </span>
                </a>
              )}
              <button
                onClick={startCheckout}
                className="sf-buy flex items-center gap-1.5 rounded-xl bg-primary px-6 py-3 font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
              >
                <ShoppingCart className="h-4 w-4" />
                {dict.store.checkout}
              </button>
            </div>
          </div>
            )}
          </>
        )
      )}

      {/* The cart, on demand: lines, quantities and the running total —
          everything the sticky bar summarises but had no room to show. The
          steppers here are the same component the product list uses, so a
          quantity change is one code path, not two that can disagree. */}
      <BottomSheet
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        title={dict.store.yourOrder}
        closeLabel={dict.common.close}
        footer={
          <button
            type="button"
            onClick={() => {
              setCartOpen(false);
              startCheckout();
            }}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-bold text-primary-foreground"
          >
            {dict.store.checkout} · {formatUsd(total)}
          </button>
        }
      >
        <ul className="divide-y divide-border">
          {items.map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{p.name}</span>
                {/* The rate, with its unit. A weight line's own weight is on
                    the stepper beside it, so repeating it here would say the
                    same thing twice; what the line needs is the price the total
                    was worked out FROM, so the customer can check it.
                    Deliberately NOT the full PriceTag: that would add a
                    struck-through compare-at price and a flash bolt to every
                    piece-priced line too, and this change is not allowed to
                    restyle products that have nothing to do with it. */}
                <span className="text-sm tabular-nums text-muted-foreground">
                  {formatUsd(effectivePrice(p))}
                  {(() => {
                    const u = unitPricingOf(p);
                    return u ? (
                      <UnitSuffix unit={u} unitPrice={effectivePrice(p)} lang={lang} />
                    ) : null;
                  })()}
                </span>
              </span>
              <Stepper id={p.id} qty={cart[p.id]} />
              <span className="w-16 shrink-0 text-end font-bold tabular-nums">
                {formatUsd(effectivePrice(p) * cart[p.id])}
              </span>
            </li>
          ))}
        </ul>
        {/* The one honest disclosure, and it is about the CUT, not the money.
            See the long note in src/lib/unit-pricing.ts: the total is exact
            because the ordered weight is what the order says and what the shop
            cuts to. What genuinely varies is the last few grams of a hand-cut
            piece, so that is what this sentence says — and nothing more, because
            a warning that the total might change would be promising a
            correction this platform has no way to make. */}
        {items.some((p) => unitPricingOf(p) !== null) && (
          <p className="mt-3 rounded-xl bg-surface-muted/60 px-3.5 py-2.5 text-xs leading-relaxed text-muted-foreground">
            {dict.store.weighedNote}
          </p>
        )}
      </BottomSheet>
    </div>
  );
}
