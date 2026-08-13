import Link from "next/link";
import Image from "next/image";
import { Tag, ImageIcon } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { getOffers } from "@/lib/data/offers";
import { localized } from "@/lib/i18n-field";
import { railOnlyIfEnough } from "@/lib/rail";
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
    <section
      // Same floor as every other rail: under three offers there is no row.
      className={`py-10 sm:py-16 ${railOnlyIfEnough(offers.length)}`}
    >
      <Container>
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
              <Tag className="h-7 w-7 text-primary" />
              {dict.offers.title}
            </h2>
            <p className="mt-2 text-muted-foreground">{dict.offers.subtitle}</p>
          </div>
          {/* Reachable on phones now that the row itself is finite. */}
          <Link
            href={`/${lang}/offers`}
            className="shrink-0 whitespace-nowrap rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold transition-colors hover:border-primary hover:text-primary"
          >
            {dict.featured.viewAll}
          </Link>
        </div>

        {/* Rail on phones, the four-up grid from `lg`. */}
        <div
          data-animate
          className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-4 lg:gap-4 lg:overflow-visible lg:px-0 lg:pb-0 [&::-webkit-scrollbar]:hidden"
        >
          {offers.map((p) => (
            <Link
              key={p.id}
              href={`/${lang}/product/${p.id}`}
              className="group flex w-42 shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-border bg-surface transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-md lg:w-auto"
            >
              <div className="relative overflow-hidden">
                {p.imageUrl ? (
                  <Image
                    src={p.imageUrl}
                    alt={localized(p.name, p.nameEn, lang)}
                    width={300}
                    height={200}
                    className="h-36 w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                    sizes="(max-width: 640px) 50vw, 25vw"
                  />
                ) : (
                  <div className="flex h-36 w-full items-center justify-center bg-surface-muted">
                    <ImageIcon className="h-10 w-10 text-foreground/10" />
                  </div>
                )}
                {p.off > 0 && (
                  <span className="absolute end-2 top-2 rounded-full bg-danger-strong px-2 py-0.5 text-xs font-bold text-danger-strong-foreground shadow-sm">
                    -{p.off}%
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col p-3">
                <h3 className="line-clamp-2 font-bold leading-tight transition-colors group-hover:text-primary">
                  {localized(p.name, p.nameEn, lang)}
                </h3>
                <p className="mt-2">
                  <span className="font-bold text-primary">
                    {formatPrice(p.discountPrice ?? p.price)}
                  </span>{" "}
                  {p.discountPrice != null && (
                    <span className="text-xs text-muted-foreground line-through">
                      {formatPrice(p.price)}
                    </span>
                  )}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </Container>
    </section>
  );
}
