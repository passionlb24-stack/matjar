import Link from "next/link";
import Image from "next/image";
import { ImageIcon, Store, MapPin } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { ListingCard } from "@/lib/data/market";

function formatPrice(price: number) {
  return price >= 1000 ? `$${Number(price).toLocaleString("en-US")}` : `$${price}`;
}

export function MarketListingCard({
  listing,
  lang,
  dict,
}: {
  listing: ListingCard;
  lang: Locale;
  dict: Dictionary;
}) {
  return (
    <Link
      href={`/${lang}/market/${listing.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-surface transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative">
        {listing.image ? (
          <Image
            src={listing.image}
            alt=""
            width={300}
            height={220}
            className="h-40 w-full object-cover"
            sizes="(max-width: 640px) 50vw, 25vw"
          />
        ) : (
          <div className="flex h-40 w-full items-center justify-center bg-surface-muted">
            <ImageIcon className="h-10 w-10 text-black/10" />
          </div>
        )}
        {listing.storeName && (
          <span className="absolute start-2 top-2 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
            <Store className="h-3 w-3" />
            {dict.market.sellerMerchant}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-3">
        <h3 className="line-clamp-2 font-bold leading-tight group-hover:text-primary">
          {listing.title}
        </h3>
        {listing.price != null && (
          <p className="mt-1 font-extrabold text-primary">
            {formatPrice(listing.price)}
          </p>
        )}
        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3" />
          {[listing.city, listing.categoryName].filter(Boolean).join(" · ")}
        </p>
      </div>
    </Link>
  );
}
