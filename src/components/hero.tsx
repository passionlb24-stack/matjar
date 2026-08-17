import Link from "next/link";
import { dictSlice } from "@/lib/dict-slice";
import { ShoppingBag } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { Container } from "@/components/ui/container";
import { HeroSearch } from "@/components/hero-search";

// V2 hero: one clear line, one supporting line, and search as the primary
// action. No statistic wall (the live inventory cannot honestly support one),
// no decorative floats, no merchant pitch — that lives at the bottom of the
// page and on /merchants.
export function Hero({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const popular =
    lang === "ar"
      ? ["مطاعم", "عيادات", "ملابس", "عقارات", "سيارات", "صيانة"]
      : ["Restaurants", "Clinics", "Clothing", "Real estate", "Cars", "Repair"];
  const t = dict.hero;

  return (
    <section className="border-b border-border bg-surface-muted/30">
      <Container className="py-10 text-center sm:py-14">
        <h1 className="mx-auto max-w-2xl text-3xl font-extrabold leading-[1.15] tracking-tight text-balance sm:text-4xl lg:text-5xl">
          {t.title} <span className="text-primary">{t.titleHighlight}</span>
        </h1>

        <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
          {t.subtitle}
        </p>

        {/* Phones already carry a search entry in the sticky header, which
            opens a full-screen field with the customer's own history. A
            second box here is the same destination twice on one screen, and
            it is the taller of the two. Desktop has no such header field
            above the fold, so it keeps this one. */}
        <div className="hidden lg:block">
          <HeroSearch lang={lang} dict={dictSlice(dict, ["hero"])} popular={popular} />
        </div>

        {/* Below `lg` the header search is the primary action, so the hero's
            own button carries the browse intent instead. 44px tall. */}
        <Link
          href={`/${lang}/explore`}
          className="mt-6 inline-flex h-11 items-center gap-2 rounded-2xl bg-primary px-6 text-[15px] font-bold text-primary-foreground transition-colors hover:bg-primary-hover lg:mt-8"
        >
          <ShoppingBag className="h-5 w-5" />
          {t.ctaPrimary}
        </Link>
      </Container>
    </section>
  );
}
