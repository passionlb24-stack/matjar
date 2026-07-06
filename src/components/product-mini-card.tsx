import Link from "next/link";
import Image from "next/image";
import { ImageIcon } from "lucide-react";
import type { Locale } from "@/i18n/config";
import { formatLbp } from "@/lib/currency";

function formatPrice(price: number) {
  return price >= 1000 ? `$${Number(price).toLocaleString("en-US")}` : `$${price}`;
}

// Compact product card used in discovery rows (related products, etc.).
export function ProductMiniCard({
  lang,
  id,
  name,
  price,
  discountPrice,
  imageUrl,
  storeName,
  lbpRate = 0,
}: {
  lang: Locale;
  id: string;
  name: string;
  price: number;
  discountPrice: number | null;
  imageUrl: string | null;
  storeName?: string;
  lbpRate?: number;
}) {
  const shown = discountPrice ?? price;
  return (
    <Link
      href={`/${lang}/product/${id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-surface transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={name}
          width={300}
          height={200}
          className="h-32 w-full object-cover"
          sizes="(max-width: 640px) 50vw, 25vw"
        />
      ) : (
        <div className="flex h-32 w-full items-center justify-center bg-surface-muted">
          <ImageIcon className="h-9 w-9 text-black/10" />
        </div>
      )}
      <div className="flex flex-1 flex-col p-3">
        <h3 className="line-clamp-2 text-sm font-bold leading-tight group-hover:text-primary">
          {name}
        </h3>
        {storeName ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{storeName}</p>
        ) : null}
        <p className="mt-1.5">
          <span className="font-bold text-primary">{formatPrice(shown)}</span>{" "}
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
