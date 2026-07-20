import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { Container } from "@/components/ui/container";

export function MerchantCta({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  return (
    <section className="py-14 sm:py-16">
      <Container>
        <div
          data-animate
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-primary-hover px-6 py-12 text-center shadow-xl sm:px-12 sm:py-16"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -end-10 -top-10 h-48 w-48 rounded-full bg-white/10 blur-2xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-12 -start-12 h-56 w-56 rounded-full bg-white/5 blur-2xl"
          />
          <h2 className="mx-auto max-w-2xl text-3xl font-extrabold text-primary-foreground text-balance sm:text-4xl">
            {dict.merchantCta.title}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-primary-foreground/80">
            {dict.merchantCta.subtitle}
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href={`/${lang}/merchant/new`}
              className="inline-flex h-12 items-center justify-center rounded-xl bg-white px-7 font-bold text-primary shadow-md transition-[transform,box-shadow] duration-150 hover:shadow-lg active:scale-[0.97]"
            >
              {dict.merchantCta.button}
            </Link>
            <Link
              href={`/${lang}/pricing`}
              className="inline-flex h-12 items-center justify-center rounded-xl border border-white/40 px-7 font-semibold text-white transition-[transform,background-color] duration-150 hover:bg-white/10 active:scale-[0.97]"
            >
              {dict.merchantCta.secondary}
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}
