import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { Container } from "@/components/ui/container";
import { ChevronNext } from "@/components/ui/directional-icon";

// The merchant pitch is one line at the foot of a customer page. The feature
// list, the pricing and the proof all live on /merchants — this is only the
// door to them.
//
// On a phone it is one door rather than a sentence plus a button: the pitch
// line stacked above its own link cost 141px of a page that is trying to get
// shorter, and the two halves went to the same place. Below `sm` the whole row
// is the link. It stays on the page — with `افتح متجرك` gone from the phone
// header this and the ☰ menu are the merchant's route in from Home, and the
// header CTA was removed because it competed for a customer's attention, not
// because the door should not exist.
export function MerchantCta({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  return (
    <section className="border-t border-border py-5 sm:py-8">
      <Container>
        <div className="relative flex items-center justify-between gap-3">
          <p className="text-sm font-bold sm:text-base">
            {dict.merchantCta.title}
          </p>
          {/* One label, one row, at every width. Below `sm` the button drops to
              the chevron alone — the sentence beside it already says where it
              goes, and spelling it out twice is what made this block 141px tall
              on a phone. The `before:inset-0` resolves against the relative row
              above, so the whole row is the tap target even though only the
              chevron is drawn; at `sm` the label comes back and the stretch is
              switched off. */}
          <Link
            href={`/${lang}/merchants`}
            aria-label={dict.merchantCta.link}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center gap-1 rounded-2xl border border-border bg-surface text-sm font-bold transition-colors before:absolute before:inset-0 before:content-[''] hover:border-primary/40 hover:text-primary sm:w-auto sm:px-5 sm:before:hidden"
          >
            <span className="hidden sm:inline">{dict.merchantCta.link}</span>
            <ChevronNext className="h-4 w-4 text-primary sm:text-current" />
          </Link>
        </div>
      </Container>
    </section>
  );
}
