import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { Bookmark, Heart, ImageIcon } from "lucide-react";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { getUsdLbpRate } from "@/lib/data/settings";
import { formatLbp } from "@/lib/currency";
import { Money } from "@/components/ui/money";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { EmptyState } from "@/components/ui/empty-state";
import { StoreCard } from "@/components/store-card";
import type { CategoryKey, RegionKey, Store } from "@/lib/catalog";
import type { StorePlan } from "@/lib/plan-tiers";

type FavRow = {
  stores: {
    id: string;
    name: string;
    area: string | null;
    region: string | null;
    plan: StorePlan | null;
    business_types: { slug: string } | null;
  } | null;
};

type WishRow = {
  products: {
    id: string;
    name: string;
    price: number;
    discount_price: number | null;
    image_url: string | null;
    status: string;
    stores: { name: string } | null;
  } | null;
};

/** The two things a customer can save. `stores` is the default segment. */
type Tab = "stores" | "products";

// Everything the customer saved, on one screen (MP-024).
//
// There used to be two: /favorites held saved STORES (the follows table) and
// /wishlist held saved PRODUCTS, they were named differently in the dictionary,
// and the المفضلة tab reached only the first — so a customer who tapped the
// heart on a product could reach it from nowhere in the tab bar and had to
// remember a URL. Same gesture, same word for it, two screens, one of them
// unreachable.
//
// One screen with two segments instead. The segment is a URL parameter rather
// than client state so a saved link, a back button and a share all land on the
// half the customer meant — and so this stays a server component with no
// hydration cost on a screen that is otherwise pure data.
//
// /wishlist is NOT deleted: it redirects here with the products segment
// selected, because customers bookmark the things they saved.
export default async function FavoritesPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const { tab: rawTab } = await searchParams;
  const tab: Tab = rawTab === "products" ? "products" : "stores";
  const dict = await getDictionary(lang);
  const l = lang as Locale;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${lang}/login?next=/${lang}/favorites`);

  // Both sides are read every time so the segment chips can carry counts —
  // a segment that turns out to be empty after you tap it is the same dead end
  // the activity rail already refuses to offer.
  const [{ data: favData }, { data: wishData }] = await Promise.all([
    supabase
      .from("follows")
      .select("stores(id, name, area, region, plan, business_types(slug))")
      .eq("user_id", user.id),
    supabase
      .from("wishlist")
      .select(
        "products(id, name, price, discount_price, image_url, status, stores(name))",
      )
      .eq("user_id", user.id),
  ]);

  const stores: Store[] = ((favData ?? []) as unknown as FavRow[])
    .map((f) => f.stores)
    .filter((s): s is NonNullable<FavRow["stores"]> => Boolean(s))
    .map((s) => ({
      id: s.id,
      name: { ar: s.name, en: s.name },
      area: { ar: s.area ?? "", en: s.area ?? "" },
      region: (s.region as RegionKey) ?? undefined,
      category: (s.business_types?.slug as CategoryKey) ?? "retail",
      isOpen: true,
      plan: s.plan ?? "free",
      favorited: true,
    }));

  const products = ((wishData ?? []) as unknown as WishRow[])
    .map((w) => w.products)
    .filter((p): p is NonNullable<WishRow["products"]> => Boolean(p))
    .filter((p) => p.status === "active");

  // Only paid for when the segment showing prices is the one on screen.
  const lbpRate = tab === "products" ? await getUsdLbpRate() : 0;

  const segments: { key: Tab; label: string; count: number }[] = [
    { key: "stores", label: dict.favorites.tabStores, count: stores.length },
    {
      key: "products",
      label: dict.favorites.tabProducts,
      count: products.length,
    },
  ];

  return (
    <div className="pb-16">
      <PageHero title={dict.favorites.title} icon={Heart} />
      <Container className="py-8">
        {/* Links, not buttons: each segment is a real address. `--m-touch` is
            the 44px the rest of the app holds to, applied to the chip itself
            rather than to a pseudo-element, since these already sit on their
            own row.
            NOT a tablist. An ARIA tab switches a `tabpanel` inside the current
            document without navigating; these navigate, and a screen reader
            told "tab 1 of 2, selected" then taken to a new URL has been lied
            to. Two links to two addresses are a navigation landmark, and the
            selected one is `aria-current="page"` — the same shape the other
            URL-driven segment rows in the app use (discovery-filters, the
            crafts area/sort rails). */}
        <nav
          aria-label={dict.favorites.title}
          className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {segments.map((s) => {
            const on = tab === s.key;
            return (
              <Link
                key={s.key}
                href={
                  s.key === "stores"
                    ? `/${lang}/favorites`
                    : `/${lang}/favorites?tab=${s.key}`
                }
                aria-current={on ? "page" : undefined}
                scroll={false}
                className={`flex h-[var(--m-touch)] shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-bold transition-colors ${
                  on
                    ? "border-primary bg-primary-soft text-primary"
                    : "border-border text-muted-foreground hover:border-primary/40"
                }`}
              >
                {s.label}
                <span className="text-xs opacity-70 tabular-nums">
                  {s.count}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-6">
          {tab === "stores" ? (
            stores.length ? (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {stores.map((s) => (
                  <StoreCard key={s.id} store={s} lang={l} dict={dict} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Heart}
                title={dict.favorites.empty}
                action={{ href: `/${lang}/explore`, label: dict.common.explore }}
              />
            )
          ) : products.length ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {products.map((p) => {
                const price = Number(p.price);
                const discount =
                  p.discount_price != null ? Number(p.discount_price) : null;
                return (
                  <Link
                    key={p.id}
                    href={`/${lang}/product/${p.id}`}
                    className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-surface transition-all hover:-translate-y-0.5 hover:shadow-md"
                  >
                    {p.image_url ? (
                      <Image
                        src={p.image_url}
                        alt={p.name}
                        width={300}
                        height={200}
                        className="h-36 w-full object-cover"
                        sizes="(max-width: 640px) 50vw, 25vw"
                      />
                    ) : (
                      <div className="flex h-36 w-full items-center justify-center bg-surface-muted">
                        <ImageIcon className="h-10 w-10 text-foreground/10" />
                      </div>
                    )}
                    <div className="flex flex-1 flex-col p-3">
                      <h3
                        dir="auto"
                        className="line-clamp-2 font-bold leading-tight group-hover:text-primary"
                      >
                        {p.name}
                      </h3>
                      <p
                        dir="auto"
                        className="mt-0.5 text-xs text-muted-foreground"
                      >
                        {p.stores?.name}
                      </p>
                      <p className="mt-2">
                        <span className="text-money font-bold text-primary">
                          <Money value={discount ?? price} />
                        </span>{" "}
                        {discount != null && (
                          <span className="text-money text-xs text-muted-foreground line-through">
                            <Money value={price} />
                          </span>
                        )}
                      </p>
                      {lbpRate > 0 && (
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {formatLbp(discount ?? price, lbpRate, l)}
                        </p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={Bookmark}
              title={dict.wishlist.empty}
              action={{ href: `/${lang}/explore`, label: dict.common.explore }}
            />
          )}
        </div>
      </Container>
    </div>
  );
}
