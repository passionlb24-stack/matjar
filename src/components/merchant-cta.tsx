import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { Container } from "@/components/ui/container";
import { ChevronNext } from "@/components/ui/directional-icon";

// The merchant pitch is one line at the foot of a customer page. The feature
// list, the pricing and the proof all live on /merchants — this is only the
// door to them.
export function MerchantCta({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  return (
    <section className="border-t border-border py-8">
      <Container>
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-bold sm:text-base">
            {dict.merchantCta.title}
          </p>
          <Link
            href={`/${lang}/merchants`}
            className="inline-flex h-11 shrink-0 items-center gap-1 rounded-2xl border border-border bg-surface px-5 text-sm font-bold transition-colors hover:border-primary/40 hover:text-primary"
          >
            {dict.merchantCta.link}
            <ChevronNext className="h-4 w-4" />
          </Link>
        </div>
      </Container>
    </section>
  );
}
