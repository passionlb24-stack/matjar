import Link from "next/link";
import Image from "next/image";
import { ImageIcon, Store, MapPin } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { ListingCard } from "@/lib/data/market";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
    <Card
      variant="interactive"
      className="group relative flex flex-col overflow-hidden"
    >
      <div className="relative overflow-hidden">
        {listing.image ? (
          <Image
            src={listing.image}
            alt={listing.title}
            width={300}
            height={220}
            className="h-40 w-full object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, 25vw"
          />
        ) : (
          <div className="flex h-40 w-full items-center justify-center bg-surface-muted">
            <ImageIcon className="h-10 w-10 text-foreground/10" />
          </div>
        )}
        {listing.storeName && (
          <Badge
            variant="primary"
            size="sm"
            className="absolute start-2 top-2 bg-primary text-primary-foreground shadow-sm"
          >
            <Store className="h-3 w-3" />
            {dict.market.sellerMerchant}
          </Badge>
        )}
      </div>
      <div className="flex flex-1 flex-col p-3">
        <h3 className="line-clamp-2 font-bold leading-tight transition-colors group-hover:text-primary">
          {listing.title}
        </h3>
        {listing.price != null && (
          <p className="mt-1 text-lg font-extrabold text-primary">
            {formatPrice(listing.price)}
          </p>
        )}
        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3 shrink-0" />
          {[listing.city, listing.categoryName].filter(Boolean).join(" · ")}
        </p>
      </div>

      <Link
        href={`/${lang}/market/${listing.id}`}
        aria-label={listing.title}
        className="absolute inset-0 z-0"
      />
    </Card>
  );
}
