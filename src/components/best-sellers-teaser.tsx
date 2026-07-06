import Link from "next/link";
import Image from "next/image";
import { Flame, ImageIcon } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { getBestSellers } from "@/lib/data/best-sellers";
import { Container } from "@/components/ui/container";

function formatPrice(price: number) {
  return price >= 1000 ? `$${Number(price).toLocaleString("en-US")}` : `$${price}`;
}

// Homepage "best sellers" teaser — renders nothing when there are no sales yet.
export async function BestSellersTeaser({
  lang,
  dict,
}: {
  lang: Locale;
  dict: Dictionary;
}) {
  const products = (await getBestSellers(8)).slice(0, 4);
  if (products.length === 0) return null;

  return (
    <section className="bg-surface-muted/40 py-14 sm:py-16">
      <Container>
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-3xl font-extrabold tracking-tight">
              <Flame className="h-7 w-7 text-primary" />
              {dict.bestSellers.title}
            </h2>
            <p className="mt-2 text-muted-foreground">{dict.bestSellers.subtitle}</p>
          </div>
          <Link
            href={`/${lang}/best-sellers`}
            className="hidden whitespace-nowrap rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold transition-colors hover:border-primary hover:text-primary sm:block"
          >
            {dict.featured.viewAll}
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {products.map((p, i) => (
            <Link
              key={p.id}
              href={`/${lang}/product/${p.id}`}
              className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-surface transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="relative">
                {p.imageUrl ? (
                  <Image
                    src={p.imageUrl}
                    alt={p.name}
                    width={300}
                    height={200}
                    className="h-36 w-full object-cover"
                    sizes="(max-width: 640px) 50vw, 25vw"
                  />
                ) : (
                  <div className="flex h-36 w-full items-center justify-center bg-surface-muted">
                    <ImageIcon className="h-10 w-10 text-black/10" />
                  </div>
                )}
                <span className="absolute start-2 top-2 rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
                  #{i + 1}
                </span>
              </div>
              <div className="flex flex-1 flex-col p-3">
                <h3 className="line-clamp-2 font-bold leading-tight group-hover:text-primary">
                  {p.name}
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">{p.storeName}</p>
                <p className="mt-2 font-bold text-primary">
                  {formatPrice(p.discountPrice ?? p.price)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </Container>
    </section>
  );
}
