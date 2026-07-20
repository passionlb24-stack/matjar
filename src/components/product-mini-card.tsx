import Link from "next/link";
import Image from "next/image";
import { ImageIcon } from "lucide-react";
import type { Locale } from "@/i18n/config";
import { formatLbp } from "@/lib/currency";
import { localized } from "@/lib/i18n-field";

function formatPrice(price: number) {
  return price >= 1000 ? `$${Number(price).toLocaleString("en-US")}` : `$${price}`;
}

// Compact product card used in discovery rows (related products, etc.).
export function ProductMiniCard({
  lang,
  id,
  name,
  nameEn,
  price,
  discountPrice,
  imageUrl,
  storeName,
  lbpRate = 0,
}: {
  lang: Locale;
  id: string;
  name: string;
  nameEn?: string | null;
  price: number;
  discountPrice: number | null;
  imageUrl: string | null;
  storeName?: string;
  lbpRate?: number;
}) {
  const shown = discountPrice ?? price;
  const displayName = localized(name, nameEn, lang);
  return (
    <Link
      href={`/${lang}/product/${id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-surface transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-md"
    >
      <div className="relative overflow-hidden">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={displayName}
            width={300}
            height={200}
            className="h-32 w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
            sizes="(max-width: 640px) 50vw, 25vw"
          />
        ) : (
          <div className="flex h-32 w-full items-center justify-center bg-surface-muted">
            <ImageIcon className="h-9 w-9 text-black/10 transition-transform duration-500 group-hover:scale-110" />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-3">
        <h3 className="line-clamp-2 text-sm font-bold leading-tight transition-colors group-hover:text-primary">
          {displayName}
        </h3>
        {storeName ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{storeName}</p>
        ) : null}
        <p className="mt-1.5">
          <span className="text-base font-bold text-primary">{formatPrice(shown)}</span>{" "}
          {discountPrice != null && (
            <span className="text-xs text-muted-foreground line-through">
              {formatPrice(price)}
            </span>
          )}
        </p>
        {lbpRate > 0 && (
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {formatLbp(shown, lbpRate, lang)}
          </p>
        )}
      </div>
    </Link>
  );
}
