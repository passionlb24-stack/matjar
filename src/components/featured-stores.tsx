import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { getFeaturedStores } from "@/lib/data/stores";
import { Container } from "@/components/ui/container";
import { StoreCard } from "@/components/store-card";

export async function FeaturedStores({
  lang,
  dict,
}: {
  lang: Locale;
  dict: Dictionary;
}) {
  const featuredStores = await getFeaturedStores(4);

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

        {featuredStores.length ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {featuredStores.map((store) => (
              <StoreCard key={store.id} store={store} lang={lang} dict={dict} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-surface px-6 py-12 text-center">
            <h3 className="text-lg font-extrabold">{dict.featured.emptyTitle}</h3>
            <p className="mx-auto mt-2 max-w-md text-muted-foreground">
              {dict.featured.emptyBody}
            </p>
            <Link
              href={`/${lang}/merchant/new`}
              className="mt-5 inline-block rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              {dict.featured.emptyCta}
            </Link>
          </div>
        )}
      </Container>
    </section>
  );
}
