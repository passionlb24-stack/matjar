import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { Container } from "@/components/ui/container";

export function MerchantCta({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  return (
    <section className="py-14 sm:py-16">
      <Container>
        <div className="relative overflow-hidden rounded-3xl bg-primary px-6 py-12 text-center sm:px-12 sm:py-16">
          <div
            aria-hidden
            className="pointer-events-none absolute -end-10 -top-10 h-48 w-48 rounded-full bg-white/10"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-12 -start-12 h-56 w-56 rounded-full bg-white/5"
          />
          <h2 className="mx-auto max-w-2xl text-3xl font-extrabold text-primary-foreground sm:text-4xl">
            {dict.merchantCta.title}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-primary-foreground/80">
            {dict.merchantCta.subtitle}
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href={`/${lang}/merchant/new`}
              className="rounded-xl bg-white px-7 py-3 font-bold text-primary transition-transform hover:scale-[1.02]"
            >
              {dict.merchantCta.button}
            </Link>
            <Link
              href={`/${lang}/pricing`}
              className="rounded-xl border border-white/30 px-7 py-3 font-semibold text-white transition-colors hover:bg-white/10"
            >
              {dict.merchantCta.secondary}
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}
