import Link from "next/link";
import { Star } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { categoryStyles, type FeaturedStore } from "@/lib/catalog";
import { categoryIcons } from "@/components/category-icon";

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

  return (
    <Link
      href={`/${lang}/store/${store.id}`}
      className="group block overflow-hidden rounded-2xl border border-border bg-surface transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className={`relative h-32 bg-gradient-to-br ${style.cover}`}>
        <Icon className="absolute end-4 top-4 h-16 w-16 text-black/[0.06]" />
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
        <span className="absolute -bottom-6 end-4 flex h-12 w-12 items-center justify-center rounded-xl border-2 border-surface bg-surface shadow-sm">
          <span
            className={`flex h-full w-full items-center justify-center rounded-[10px] ${style.iconWrap}`}
          >
            <Icon className="h-5 w-5" />
          </span>
        </span>
      </div>

      <div className="p-4 pt-7">
        <h3 className="font-bold leading-tight transition-colors group-hover:text-primary">
          {store.name[lang]}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {cat.name} · {store.area[lang]}
        </p>
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
    </Link>
  );
}
