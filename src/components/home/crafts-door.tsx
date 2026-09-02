import Link from "next/link";
import { Wrench } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { Container } from "@/components/ui/container";
import { ArrowNext } from "@/components/ui/directional-icon";

/**
 * The door to the craftsmen section, on Home.
 *
 * Not a fifth gateway tile. The four-tile row is sized for four: at 320px each
 * tile is already 64px wide with a two-line label, and a fifth would put a
 * label like «صحة وعيادات» on three lines in a 50px column. This is its own
 * strip instead, and it can say more than a tile can — the trades a customer
 * would think of, and the one action that works today.
 *
 * Why it exists at all, given that /crafts has no providers yet (0 on
 * 2026-09-02): the section was gated off Home, the header, the menu and the
 * footer by the supply rule in section-supply.ts, so the page where a
 * tradesman signs up was reachable from nowhere — and the owner asked why the
 * section was invisible. The gate now has an explicit exception for crafts,
 * and this strip is the Home half of the same decision. The page it leads to
 * does not pretend: its zero state says «لسا ما في حرفي مسجّل» and offers a
 * request form and a sign-up, which is the recruitment funnel, not a dead end.
 *
 * Every string is an existing `dict.crafts` key. No new dictionary entries.
 */
export function CraftsDoor({
  lang,
  dict,
}: {
  lang: Locale;
  dict: Pick<Dictionary, "crafts">;
}) {
  const t = dict.crafts;
  return (
    <section className="pt-6 lg:pt-8">
      <Container>
        <Link
          href={`/${lang}/crafts`}
          className="group flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-primary/40 sm:p-5"
        >
          <span
            aria-hidden
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-tint-7-soft text-tint-7"
          >
            <Wrench className="h-6 w-6" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-extrabold leading-tight sm:text-lg">
              {t.heroTitle}
            </span>
            <span className="mt-1 block truncate text-sm text-muted-foreground">
              {t.heroSubtitle}
            </span>
          </span>
          <ArrowNext className="h-5 w-5 shrink-0 text-primary transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
        </Link>
      </Container>
    </section>
  );
}
