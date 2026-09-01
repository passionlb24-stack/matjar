import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MessageCircle, Phone } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { Container } from "@/components/ui/container";
import { buttonVariants } from "@/components/ui/button";
import { ChevronPrev } from "@/components/ui/directional-icon";
import {
  ProfessionalIdentity,
  ProfessionalPortfolio,
  ProfessionalReviews,
  ProfessionalServiceArea,
  ProfessionalServices,
  ProfessionalStickyCta,
} from "@/components/professional";
import { getCraftProfessional } from "@/lib/data/crafts";
import { profileBlocks, primaryCtaKey, startingPrice } from "@/lib/professional";
import { formatUsd } from "@/lib/currency";
import { waLink } from "@/lib/whatsapp";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Params = Promise<{ lang: string; id: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { lang, id } = await params;
  if (!isLocale(lang) || !UUID_RE.test(id)) return {};
  const found = await getCraftProfessional(id, lang);
  if (!found) return {};
  const { profile } = found;
  return {
    title: `${profile.name}${profile.headline ? ` — ${profile.headline}` : ""}`,
    description: profile.bio ?? profile.headline ?? undefined,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// One tradesman.
//
// UNPROVEN, AND SAYING SO: craft_providers has zero rows on production, so
// this route cannot be rendered against real data by anyone, including me. It
// is verified two other ways instead — src/lib/data/crafts.test.ts drives the
// row → ProfessionalProfile resolver against a fixture that carries every
// column the schema allows, and /[lang]/preview-professional renders these
// same components against full / sparse / empty fixtures. What is genuinely
// untested is the PostgREST embed in getCraftProfessional against a live row;
// the shape of that query is inherited from the page this replaces, ambiguous
// foreign key and all.
//
// The composition is not hand-ordered. `profileBlocks()` decides both which
// blocks exist and what order they come in, from the profile itself — so a
// tradesman with no portfolio has no portfolio heading, and the craft ordering
// (trust and coverage before the work) comes from the shared engine rather
// than from this file having an opinion.
//
// §36 is load-bearing here and shows up as an absence: there is no address on
// this page because there is no address column on craft_providers. Coverage
// (`craft_provider_areas`) answers "do you come to me?", which is the question
// the customer is actually asking, and it is a different fact from where the
// man lives. The phone is reachable as an action — a `tel:` button — and never
// printed as selectable text, so the page is not a phone list to scrape.
// ────────────────────────────────────────────────────────────────────────────
export default async function CraftProviderPage({ params }: { params: Params }) {
  const { lang, id } = await params;
  if (!isLocale(lang)) notFound();
  if (!UUID_RE.test(id)) notFound();

  const found = await getCraftProfessional(id, lang);
  if (!found) notFound();

  const { profile, contact } = found;
  const dict = await getDictionary(lang);
  const t = dict.crafts;

  const blocks = profileBlocks(profile);
  const requestHref = `/${lang}/crafts/p/${profile.id}/request`;
  const from = startingPrice(profile.services);
  const ctaLabel = dict.professional.cta[primaryCtaKey(profile.kind)];

  return (
    <div className="py-8 sm:py-10">
      <Container className="max-w-3xl">
        <Link
          href={`/${lang}/crafts`}
          className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronPrev className="h-4 w-4" />
          {t.title}
        </Link>

        <ProfessionalIdentity
          profile={profile}
          dict={dict}
          lang={lang}
          className="mt-4"
        />

        {/* Contact, high on the page on purpose: on a phone the decision and
            the tap should not be a scroll apart. The sticky bar at the bottom
            of the viewport repeats the primary action, so this row does not
            have to be repeated at the end of the document. */}
        <div className="mt-5 flex min-w-0 flex-wrap gap-2">
          <Link href={requestHref} className={buttonVariants({ variant: "primary" })}>
            {ctaLabel}
          </Link>
          {contact.phone && (
            <a
              href={`tel:${contact.phone}`}
              className={buttonVariants({ variant: "secondary" })}
            >
              <Phone aria-hidden className="h-4 w-4" />
              {t.call}
            </a>
          )}
          {contact.whatsapp && (
            <a
              href={waLink(contact.whatsapp, "")}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "whatsapp" })}
            >
              <MessageCircle aria-hidden className="h-4 w-4" />
              WhatsApp
            </a>
          )}
        </div>

        {/* Blocks, in the order the shared engine says a TRADE profile reads:
            about, services, portfolio, area, availability, experience,
            reviews — and only the ones with something in them.

            Two of the seven have no component in the shared folder yet and so
            render nothing rather than something invented: `availability`
            (craft_providers.hours is free-form jsonb that nothing has ever
            written) and `experience` (already stated as a single line inside
            ProfessionalIdentity). Both are named in the report. */}
        {blocks.map((block) => {
          switch (block) {
            case "about":
              return (
                <section key={block} className="mt-8">
                  <p
                    dir="auto"
                    className="whitespace-pre-line break-words text-sm leading-relaxed text-muted-foreground"
                  >
                    {profile.bio}
                  </p>
                </section>
              );
            case "services":
              return (
                <ProfessionalServices
                  key={block}
                  services={profile.services}
                  dict={dict}
                  quoteHref={requestHref}
                  id="services"
                  className="mt-8"
                />
              );
            case "portfolio":
              return (
                <ProfessionalPortfolio
                  key={block}
                  items={profile.portfolio}
                  dict={dict}
                  className="mt-8"
                />
              );
            case "area":
              return (
                <ProfessionalServiceArea
                  key={block}
                  area={profile.area}
                  dict={dict}
                  className="mt-8"
                />
              );
            case "reviews":
              return (
                <ProfessionalReviews
                  key={block}
                  reviews={profile.reviews}
                  dict={dict}
                  lang={lang}
                  ratingAvg={profile.ratingAvg}
                  ratingCount={profile.ratingCount}
                  name={profile.name}
                  className="mt-8"
                />
              );
            default:
              return null;
          }
        })}
      </Container>

      {/* A true one-line fact or nothing: `startingPrice` returns null for a
          tradesman who only quotes, and "من $0" is a lie this platform would
          have invented. */}
      <ProfessionalStickyCta
        label={ctaLabel}
        href={requestHref}
        note={from != null ? `${t.from} ${formatUsd(from)}` : null}
      />
    </div>
  );
}
