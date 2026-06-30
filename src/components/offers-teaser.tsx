import Link from "next/link";
import Image from "next/image";
import { Tag, ImageIcon } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { getOffers } from "@/lib/data/offers";
import { Container } from "@/components/ui/container";

function formatPrice(price: number) {
  return price >= 1000 ? `$${Number(price).toLocaleString("en-US")}` : `$${price}`;
}

// Homepage teaser for "Today's offers" — renders nothing when there are none,
// so the section never looks empty.
export async function OffersTeaser({
  lang,
  dict,
}: {
  lang: Locale;
  dict: Dictionary;
}) {
  const offers = (await getOffers(8)).slice(0, 4);
  if (offers.length === 0) return null;

  return (
    <section className="py-14 sm:py-16">
      <Container>
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-3xl font-extrabold tracking-tight">
              <Tag className="h-7 w-7 text-primary" />
              {dict.offers.title}
            </h2>
            <p className="mt-2 text-muted-foreground">{dict.offers.subtitle}</p>
          </div>
          <Link
            href={`/${lang}/offers`}
            className="hidden whitespace-nowrap rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold transition-colors hover:border-primary hover:text-primary sm:block"
          >
            {dict.featured.viewAll}
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {offers.map((p) => (
            <Link
              key={p.id}
              href={`/${lang}/product/${p.id}`}
              className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-surface transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="relative">
                {p.imageUrl ? (
                  <Image
                    src={p.imageUrl}
                    alt=""
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
                {p.off > 0 && (
                  <span className="absolute end-2 top-2 rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
                    -{p.off}%
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col p-3">
                <h3 className="line-clamp-2 font-bold leading-tight group-hover:text-primary">
                  {p.name}
                </h3>
                <p className="mt-2">
                  <span className="font-bold text-primary">
                    {formatPrice(p.discountPrice)}
                  </span>{" "}
                  <span className="text-xs text-muted-foreground line-through">
                    {formatPrice(p.price)}
                  </span>
                </p>
              </div>
            </Link>
          ))}
        </div>
      </Container>
    </section>
  );
}
