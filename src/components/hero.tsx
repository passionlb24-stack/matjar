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
// V4 finishes that split. V3 kept one visible line on a phone — the headline —
// on the argument that a first-time visitor needs to be told what this is and
// nothing else on the page says it. What now says it, better, is the row of
// four sector gateways directly beneath this section: "مطاعم وأكل / صحة
// وعيادات / تسوّق / خدمات" tells a stranger what this marketplace is by showing
// what is in it, in the same glance that lets them leave for the part they
// came for. A sentence that has to be read to deliver the same information is
// the weaker of the two, and it costs the top of the only screen most
// customers ever see.
//
// So below `lg` the headline is present and announced but not drawn
// (`max-lg:sr-only`, not `hidden` — see the note on the element), the subtitle
// and the browse button are desktop-only, and what a phone actually shows here
// is the location row. At `lg` and up this component renders exactly what it
// rendered before: headline, subtitle, wide search field, browse button.
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
      <Container className="py-4 text-center lg:py-14">
        {/* V4: below `lg` the headline is read, not seen.
            `max-lg:sr-only` keeps the <h1> in the document and in the
            accessibility tree — a crawler still gets the page's one H1, a
            screen reader still hears what this site is — while giving the
            phone's first viewport back to the things a customer can act on.
            It is NOT `hidden`: display:none would take the heading out of the
            a11y tree and leave the page without an announced title on the
            width most customers arrive at. At `lg` and up nothing is hidden and
            every class below is the one that was already there. */}
        <h1 className="mx-auto max-w-2xl text-xl font-extrabold leading-snug tracking-tight text-balance max-lg:sr-only sm:text-4xl sm:leading-[1.15] lg:text-5xl">
          {t.title} <span className="text-primary">{t.titleHighlight}</span>
        </h1>

        {/* The supporting line is desktop-only now rather than `sm`-and-up:
            it restates the headline as a verb list, and the headline itself is
            no longer on screen below `lg`. */}
        <p className="mx-auto mt-4 hidden max-w-xl text-base text-muted-foreground lg:block lg:text-lg">
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

        {/* Desktop-only, and for the same reason the subtitle is: below `lg`
            the four sector gateways sit immediately under this section, and a
            single generic "start shopping" button on top of four specific doors
            is the weaker of the two offers. At `lg` the gateways are still
            there, but so is the room for this. 44px tall. */}
        <Link
          href={`/${lang}/explore`}
          className="mt-6 hidden h-11 items-center gap-2 rounded-2xl bg-primary px-6 text-[15px] font-bold text-primary-foreground transition-colors hover:bg-primary-hover lg:mt-8 lg:inline-flex"
        >
          <ShoppingBag className="h-5 w-5" />
          {t.ctaPrimary}
        </Link>
      </Container>
    </section>
  );
}
