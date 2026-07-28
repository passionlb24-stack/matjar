import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Check, Minus } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { getUsdLbpRate } from "@/lib/data/settings";
import { localeAlternates } from "@/lib/site";
import { Container } from "@/components/ui/container";
import { PricingPlans } from "@/components/pricing-plans";
import { PLAN_ORDER, PLAN_TIERS, promoState } from "@/lib/plan-tiers";

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
      ? "ثلاث خطط تناسب كل مرحلة — أساسية، احترافية، وأعمال. 0% عمولة على المبيعات، وتجربة مجانية ١٤ يوم."
      : "Three plans for every stage — Basic, Pro, and Business. 0% commission on sales, with a 14-day free trial.";
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

  // CTA routing: an existing merchant lands on their store's subscription page;
  // a new/guest user gets the open-a-store path (store creation stays free).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let ctaHref = `/${lang}/signup`;
  if (user) {
    const { data: store } = await supabase
      .from("stores")
      .select("id")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    ctaHref = store
      ? `/${lang}/merchant/${(store as { id: string }).id}/subscription`
      : `/${lang}/merchant/new`;
  }

  const lbpRate = await getUsdLbpRate();
  // Reading cookies above makes this route dynamic, so `new Date()` is per
  // request — the promo flips off automatically after PROMO_END.
  const { active: promoActive, daysLeft } = promoState(new Date());
  const t = dict.pricing;
  const cell = (v: string) =>
    v === "✓" ? (
      <Check className="mx-auto h-4 w-4 text-primary" />
    ) : v === "—" ? (
      <Minus className="mx-auto h-4 w-4 text-muted-foreground/40" />
    ) : (
      <span className="font-semibold">{v}</span>
    );

  return (
    <div className="py-14 sm:py-16">
      <Container>
        <div className="text-center">
          <h1 className="text-4xl font-extrabold tracking-tight">{t.title}</h1>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            {t.subtitle}
          </p>
        </div>

        <div className="mt-10">
          <PricingPlans
            lang={lang}
            dict={dict}
            plans={PLAN_TIERS}
            promoActive={promoActive}
            daysLeft={daysLeft}
            ctaHref={ctaHref}
            lbpRate={lbpRate}
          />
        </div>

        {/* Full feature matrix */}
        <div className="mx-auto mt-16 max-w-4xl">
          <h2 className="text-center text-2xl font-extrabold tracking-tight">
            {t.matrixTitle}
          </h2>
          <div className="mt-6 overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="bg-surface-muted/50">
                  <th className="p-3 text-start font-bold">{t.colFeature}</th>
                  {PLAN_ORDER.map((k) => (
                    <th
                      key={k}
                      className={`w-28 p-3 text-center font-bold ${
                        PLAN_TIERS[k].popular ? "text-primary" : ""
                      }`}
                    >
                      {t.tiers[k].name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {t.matrix.map((r, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="p-3 font-medium">{r.f}</td>
                    <td className="p-3 text-center">{cell(r.basic)}</td>
                    <td className="p-3 text-center">{cell(r.pro)}</td>
                    <td className="p-3 text-center">{cell(r.business)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ */}
        <div className="mx-auto mt-16 max-w-2xl">
          <h2 className="text-center text-2xl font-extrabold tracking-tight">
            {t.faqTitle}
          </h2>
          <div className="mt-6 space-y-3">
            {t.faq.map((f, i) => (
              <div
                key={i}
                className="rounded-2xl border border-border bg-surface p-5"
              >
                <h3 className="font-bold">{f.q}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {f.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </div>
  );
}
