import Link from "next/link";
import Image from "next/image";
import { Star, BadgeCheck, Navigation } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { categoryStyles, type FeaturedStore } from "@/lib/catalog";
import { categoryIcons } from "@/components/category-icon";
import { ProBadge } from "@/components/pro-badge";
import { FavoriteButton } from "@/components/favorite-button";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function StoreCard({
  store,
  lang,
  dict,
}: {
  store: FeaturedStore;
  lang: Locale;
  dict: Dictionary;
}) {
  const Icon = categoryIcons[store.category];
  const cat = dict.catalog[store.category];
  const style = categoryStyles[store.category];
  const isReal = UUID_RE.test(store.id);

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-border bg-surface transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className={`relative h-32 bg-gradient-to-br ${style.cover}`}>
        {store.coverUrl ? (
          <Image
            src={store.coverUrl}
            alt=""
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, 320px"
          />
        ) : (
          <Icon className="absolute end-4 top-4 h-16 w-16 text-black/[0.06]" />
        )}
        <span
          className={`absolute start-3 top-3 rounded-full px-2.5 py-1 text-xs font-bold text-white ${
            store.isOpen ? "bg-emerald-600" : "bg-slate-500"
          }`}
        >
          {store.isOpen ? dict.featured.open : dict.featured.closed}
        </span>
        {store.tag && (
          <span className="absolute bottom-3 start-3 rounded-full bg-surface/90 px-2.5 py-1 text-xs font-semibold backdrop-blur">
            {store.tag[lang]}
          </span>
        )}
        {isReal && (
          <FavoriteButton
            storeId={store.id}
            favorited={store.favorited ?? false}
            lang={lang}
            className="absolute end-3 top-3 z-10"
          />
        )}
        <span className="absolute -bottom-6 end-4 z-10 flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border-2 border-surface bg-surface shadow-sm">
          {store.logoUrl ? (
            <Image
              src={store.logoUrl}
              alt={store.name[lang]}
              width={48}
              height={48}
              className="h-full w-full rounded-[10px] object-cover"
            />
          ) : (
            <span
              className={`flex h-full w-full items-center justify-center rounded-[10px] ${style.iconWrap}`}
            >
              <Icon className="h-5 w-5" />
            </span>
          )}
        </span>
      </div>

      <div className="p-4 pt-7">
        <div className="flex items-center gap-2">
          <h3 className="font-bold leading-tight transition-colors group-hover:text-primary">
            {store.name[lang]}
          </h3>
          {store.plan === "pro" && <ProBadge />}
          {store.verified && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-bold text-primary">
              <BadgeCheck className="h-3 w-3" />
              {dict.featured.verified}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {cat.name} · {store.area[lang]}
        </p>
        {store.distanceKm != null && (
          <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-xs font-bold text-primary">
            <Navigation className="h-3 w-3" />
            {store.distanceKm.toFixed(1)} {dict.explore.km}
          </span>
        )}
        {store.rating != null && (
          <div className="mt-3 flex items-center gap-1.5 text-sm">
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            <span className="font-bold">{store.rating.toFixed(1)}</span>
            <span className="text-muted-foreground">
              ({store.reviews} {dict.featured.reviews})
            </span>
          </div>
        )}
      </div>

      <Link
        href={`/${lang}/store/${store.id}`}
        aria-label={store.name[lang]}
        className="absolute inset-0 z-0"
      />
    </article>
  );
}
