import Link from "next/link";
import type { ReactNode } from "react";
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
//
// V3 splits that composition by width instead of deleting half of it. On a
// desktop the block above the fold has room for a headline, a supporting line
// and a wide search field, and it keeps all three, unchanged. On a phone the
// same block cost 293px — 104 of them the `<h1>` alone — and put the first
// tappable thing on the page at 445px, past half of an 844px screen.
//
// What survives on a phone is one line saying what this is: a first-time
// visitor to an unfamiliar marketplace does need that, and nothing else on the
// page says it. What does not survive is the subtitle, which restates the
// headline as a verb list, and the "start shopping" button, which is a single
// browse target sitting directly on top of the nine-target category row that
// follows it. The headline text itself is unchanged at every width — the phone
// only renders it smaller.
//
// `children` is the phone-only location row (components/home/home-location). It
// sits inside this section rather than beside it so the top of the page reads
// as one block rather than two stacked bands.
export function Hero({
  lang,
  dict,
  children,
}: {
  lang: Locale;
  dict: Dictionary;
  children?: ReactNode;
}) {
  const popular =
    lang === "ar"
      ? ["مطاعم", "عيادات", "ملابس", "عقارات", "سيارات", "صيانة"]
      : ["Restaurants", "Clinics", "Clothing", "Real estate", "Cars", "Repair"];
  const t = dict.hero;

  return (
    <section className="border-b border-border bg-surface-muted/30">
      <Container className="py-4 text-center sm:py-14">
        <h1 className="mx-auto max-w-2xl text-xl font-extrabold leading-snug tracking-tight text-balance sm:text-4xl sm:leading-[1.15] lg:text-5xl">
          {t.title} <span className="text-primary">{t.titleHighlight}</span>
        </h1>

        <p className="mx-auto mt-4 hidden max-w-xl text-base text-muted-foreground sm:block sm:text-lg">
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

        {/* Location. Phone-only: at `lg` the same question is already asked by
            the region select inside HeroSearch above. */}
        {children ? <div className="mt-3 lg:hidden">{children}</div> : null}

        {/* From `sm` up the header search is still the primary action, so this
            button carries the browse intent. On a phone it is dropped: the
            category row immediately below is the same intent with nine
            destinations instead of one. 44px tall. */}
        <Link
          href={`/${lang}/explore`}
          className="mt-6 hidden h-11 items-center gap-2 rounded-2xl bg-primary px-6 text-[15px] font-bold text-primary-foreground transition-colors hover:bg-primary-hover sm:inline-flex lg:mt-8"
        >
          <ShoppingBag className="h-5 w-5" />
          {t.ctaPrimary}
        </Link>
      </Container>
    </section>
  );
}
