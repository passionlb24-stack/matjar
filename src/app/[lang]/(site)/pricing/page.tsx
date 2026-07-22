import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, Crown, Sparkles } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { localeAlternates } from "@/lib/site";
import { Container } from "@/components/ui/container";
import { ButtonLink } from "@/components/ui/button";
import {
  PRO_PRICE_MONTHLY,
  PRO_PRICE_YEARLY,
  PRO_PRICE_MONTHLY_LIST,
  PRO_PRICE_YEARLY_LIST,
  PRO_MONTHLY_DISCOUNT_PCT,
  PRO_YEARLY_DISCOUNT_PCT,
} from "@/lib/plan";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const title = lang === "ar" ? "الأسعار والخطط" : "Pricing & plans";
  const description =
    lang === "ar"
      ? "خطة مجانية للبداية وخطة Pro بمزايا أقوى — افتح متجرك على متجر وابدأ البيع في لبنان."
      : "A free plan to start and a Pro plan with more power — open your store on Matjar and start selling in Lebanon.";
  return { title, description, alternates: localeAlternates(lang, "/pricing") };
}

export default async function PricingPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  // Pro CTA routing: an existing merchant should REQUEST Pro for their store
  // (which reaches admins) — never be pushed to re-create a store. New/guest
  // users still get the open-a-store path.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let proHref = `/${lang}/signup`;
  if (user) {
    const { data: store } = await supabase
      .from("stores")
      .select("id")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    proHref = store
      ? `/${lang}/merchant/${(store as { id: string }).id}/subscription`
      : `/${lang}/merchant/new`;
  }

  const freeFeatures = dict.pricing.freeFeatures;
  const proFeatures = dict.pricing.proFeatures;
  const discountLabel = (pct: number) =>
    dict.pricing.discountOff.replace("{pct}", String(pct));

  return (
    <div className="py-14 sm:py-16">
      <Container>
        <div className="text-center">
          <h1 className="text-4xl font-extrabold tracking-tight">
            {dict.pricing.title}
          </h1>
          <p className="mt-3 text-muted-foreground">{dict.pricing.subtitle}</p>
        </div>

        <div className="mx-auto mt-10 grid max-w-4xl items-start gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-border bg-surface p-8">
            <h2 className="text-lg font-bold">{dict.pricing.free}</h2>
            <p className="mt-3">
              <span className="text-4xl font-extrabold">$0</span>
              <span className="text-muted-foreground">
                {dict.pricing.perMonth}
              </span>
            </p>
            <ul className="mt-6 space-y-3">
              {freeFeatures.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <ButtonLink
              href={`/${lang}/signup`}
              variant="secondary"
              size="lg"
              full
              className="mt-8"
            >
              {dict.pricing.startFree}
            </ButtonLink>
          </div>

          <div className="relative rounded-3xl border-2 border-primary bg-surface p-8">
            <span className="absolute -top-3 start-8 rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">
              {dict.pricing.popular}
            </span>
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Crown className="h-5 w-5 text-amber-500" />
              {dict.pricing.pro}
            </h2>

            {/* Monthly + yearly, each showing the list price struck through next
                to the discounted effective price and a launch-discount badge. */}
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-background/50 px-4 py-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {dict.pricing.monthly}
                  </p>
                  <p className="mt-0.5 flex items-baseline gap-1.5">
                    <span className="text-3xl font-extrabold">
                      ${PRO_PRICE_MONTHLY}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {dict.pricing.perMonth}
                    </span>
                    <span className="text-sm text-muted-foreground line-through">
                      ${PRO_PRICE_MONTHLY_LIST}
                    </span>
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-success-soft px-2.5 py-1 text-xs font-bold text-success">
                  {discountLabel(PRO_MONTHLY_DISCOUNT_PCT)}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-background/50 px-4 py-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {dict.pricing.yearly}
                  </p>
                  <p className="mt-0.5 flex items-baseline gap-1.5">
                    <span className="text-3xl font-extrabold">
                      ${PRO_PRICE_YEARLY}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {dict.pricing.perYear}
                    </span>
                    <span className="text-sm text-muted-foreground line-through">
                      ${PRO_PRICE_YEARLY_LIST}
                    </span>
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-success-soft px-2.5 py-1 text-xs font-bold text-success">
                  {discountLabel(PRO_YEARLY_DISCOUNT_PCT)}
                </span>
              </div>
            </div>

            {/* Prominent free-trial line. */}
            <div className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-primary/10 px-4 py-2.5 text-center text-sm font-bold text-primary">
              <Sparkles className="h-4 w-4 shrink-0" />
              {dict.pricing.freeTrial}
            </div>

            <ul className="mt-6 space-y-3">
              {proFeatures.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <ButtonLink
              href={proHref}
              variant="primary"
              size="lg"
              full
              className="mt-8"
            >
              {dict.pricing.goPro}
            </ButtonLink>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              {dict.pricing.contactNote}
            </p>
          </div>
        </div>

        {/* Trial highlight */}
        <div className="mx-auto mt-8 flex max-w-4xl items-center justify-center gap-2 rounded-2xl border border-primary/30 bg-primary/10 px-5 py-3.5 text-center text-sm font-bold text-primary">
          <Sparkles className="h-5 w-5 shrink-0" />
          {dict.pricing.trialBanner}
        </div>

        {/* Comparison */}
        <div className="mx-auto mt-14 max-w-3xl">
          <h2 className="text-center text-2xl font-extrabold tracking-tight">{dict.pricing.compareTitle}</h2>
          <div className="mt-6 overflow-hidden rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-muted/50">
                  <th className="p-3 text-start font-bold">{dict.pricing.compareFeature}</th>
                  <th className="w-24 p-3 text-center font-bold text-muted-foreground">{dict.pricing.free}</th>
                  <th className="w-24 p-3 text-center font-bold text-primary">{dict.pricing.pro}</th>
                </tr>
              </thead>
              <tbody>
                {dict.pricing.compareRows.map((r, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="p-3 font-medium">{r.f}</td>
                    <td className="p-3 text-center text-muted-foreground">{r.free}</td>
                    <td className="p-3 text-center font-bold text-primary">{r.pro}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ */}
        <div className="mx-auto mt-14 max-w-2xl">
          <h2 className="text-center text-2xl font-extrabold tracking-tight">{dict.pricing.faqTitle}</h2>
          <div className="mt-6 space-y-3">
            {dict.pricing.faq.map((f, i) => (
              <div key={i} className="rounded-2xl border border-border bg-surface p-5">
                <h3 className="font-bold">{f.q}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </div>
  );
}
