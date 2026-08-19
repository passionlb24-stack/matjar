import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Store } from "@/lib/catalog";
import { Container } from "@/components/ui/container";
import { StoreCard } from "@/components/store-card";
import { ChevronNext } from "@/components/ui/directional-icon";

// A premium horizontal "rail" of store cards — the pattern shoppers know from
// Netflix/Shopify/app stores. Scroll-snaps on touch, bleeds to the screen edge
// on mobile, and hides its scrollbar. One component powers every store row.
export function StoreRail({
  stores,
  lang,
  dict,
  title,
  subtitle,
  href,
  seeAll,
  emptyText,
  className = "",
}: {
  stores: Store[];
  lang: Locale;
  dict: Dictionary;
  title: string;
  subtitle?: string;
  href: string;
  seeAll: string;
  emptyText?: string;
  // Escape hatch for the caller's own visibility rule (see lib/rail.ts) — the
  // rail itself has no opinion on how few stores is too few.
  className?: string;
}) {
  if (!stores.length && !emptyText) return null;

  return (
    <section className={`py-8 sm:py-12 ${className}`}>
      <Container>
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-1.5 text-sm text-muted-foreground sm:text-base">
                {subtitle}
              </p>
            )}
          </div>
          <Link
            href={href}
            className="inline-flex shrink-0 items-center gap-1 text-sm font-bold text-primary transition-colors hover:text-primary-hover"
          >
            {seeAll}
            <ChevronNext className="h-4 w-4" />
          </Link>
        </div>
      </Container>

      {stores.length ? (
        <div className="mx-auto flex max-w-7xl snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:px-6 lg:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {stores.map((store) => (
            <div key={store.id} className="w-[270px] shrink-0 snap-start sm:w-[290px]">
              <StoreCard store={store} lang={lang} dict={dict} />
            </div>
          ))}
        </div>
      ) : (
        <Container>
          <div className="rounded-2xl border border-dashed border-border bg-surface px-6 py-10 text-center text-muted-foreground">
            {emptyText}
          </div>
        </Container>
      )}
    </section>
  );
}
