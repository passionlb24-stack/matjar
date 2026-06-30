import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { featuredStores } from "@/lib/catalog";
import { Container } from "@/components/ui/container";
import { StoreCard } from "@/components/store-card";

export function FeaturedStores({
  lang,
  dict,
}: {
  lang: Locale;
  dict: Dictionary;
}) {
  return (
    <section className="bg-surface-muted/40 py-14 sm:py-16">
      <Container>
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight">
              {dict.featured.title}
            </h2>
            <p className="mt-2 text-muted-foreground">{dict.featured.subtitle}</p>
          </div>
          <Link
            href={`/${lang}/explore`}
            className="hidden whitespace-nowrap rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold transition-colors hover:border-primary hover:text-primary sm:block"
          >
            {dict.featured.viewAll}
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {featuredStores.map((store) => (
            <StoreCard key={store.id} store={store} lang={lang} dict={dict} />
          ))}
        </div>
      </Container>
    </section>
  );
}
