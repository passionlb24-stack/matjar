import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  BadgeCheck,
  CheckCircle2,
  ChevronRight,
  MapPin,
  MessageCircle,
  Phone,
  Star,
  Wrench,
} from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/container";
import { waLink } from "@/lib/whatsapp";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Params = Promise<{ lang: string; id: string }>;

const PRICING_KEYS: Record<string, string> = {
  fixed: "priceFixed",
  from: "priceFrom",
  hourly: "priceHourly",
  per_meter: "pricePerMeter",
  quote: "priceQuote",
};

async function loadProvider(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("craft_providers")
    .select(
      // lb_areas is reachable two ways from here — the provider's own base area
      // and the areas they cover — so the foreign key is named explicitly.
      // Without it PostgREST cannot pick one, the request errors, and the page
      // 404s as if the provider did not exist.
      `id, name, headline, bio, photo_url, kind, phone, whatsapp, years_experience,
       region, status, verified, rating_avg, rating_count, completed_count,
       lb_areas!craft_providers_area_id_fkey(name_ar, name_en),
       craft_provider_trades(trades(slug, name_ar, name_en, icon)),
       craft_provider_areas(lb_areas(slug, name_ar, name_en)),
       craft_services(id, name, description, pricing_type, price, duration_minutes, sort_order),
       craft_works(id, title, image_url, sort_order),
       craft_reviews(id, rating, comment, customer_name, created_at)`,
    )
    .eq("id", id)
    .maybeSingle();

  // A malformed embed fails the whole request and returns no row, which is
  // indistinguishable from "no such provider" — this page 404'd for a live,
  // published tradesman until the ambiguous lb_areas join above was named.
  // Say so in the log rather than letting the next one hide the same way.
  if (error) {
    console.error("craft provider load failed", { id, message: error.message });
  }
  return data as Record<string, unknown> | null;
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { lang, id } = await params;
  if (!isLocale(lang) || !UUID_RE.test(id)) return {};
  const p = await loadProvider(id);
  if (!p || p.status !== "active") return {};
  return {
    title: `${p.name as string}${p.headline ? ` — ${p.headline as string}` : ""}`,
    description: (p.bio as string | null) ?? undefined,
  };
}

// One tradesman's profile.
//
// Ordered the way a Lebanese customer decides, not the way a CV is written:
// who and what trade, then can I trust them, then what does it cost, then how
// do I reach them. Contact sits high and repeats at the bottom, because on a
// phone the decision and the tap should never be a scroll apart.
export default async function CraftProviderPage({ params }: { params: Params }) {
  const { lang, id } = await params;
  if (!isLocale(lang)) notFound();
  if (!UUID_RE.test(id)) notFound();

  const p = await loadProvider(id);
  // RLS already hides non-active providers from the public; this makes the
  // owner previewing their own pending profile see a 404 rather than a page
  // that does not exist for anyone else.
  if (!p || p.status !== "active") notFound();

  const dict = await getDictionary(lang);
  const t = dict.crafts;
  const ar = lang === "ar";

  const trades = (
    (p.craft_provider_trades ?? []) as {
      trades: { slug: string; name_ar: string; name_en: string; icon: string | null } | null;
    }[]
  )
    .map((r) => r.trades)
    .filter(Boolean) as { slug: string; name_ar: string; name_en: string; icon: string | null }[];

  const areas = (
    (p.craft_provider_areas ?? []) as {
      lb_areas: { slug: string; name_ar: string; name_en: string } | null;
    }[]
  )
    .map((r) => r.lb_areas)
    .filter(Boolean) as { slug: string; name_ar: string; name_en: string }[];

  const services = ((p.craft_services ?? []) as {
    id: string;
    name: string;
    description: string | null;
    pricing_type: string;
    price: number | null;
    duration_minutes: number | null;
    sort_order: number;
  }[]).sort((a, b) => a.sort_order - b.sort_order);

  const works = ((p.craft_works ?? []) as {
    id: string;
    title: string | null;
    image_url: string;
    sort_order: number;
  }[]).sort((a, b) => a.sort_order - b.sort_order);

  // Newest first, and only the ones that said something — a wall of bare stars
  // adds nothing the average above already says.
  const reviews = ((p.craft_reviews ?? []) as {
    id: string;
    rating: number;
    comment: string | null;
    customer_name: string | null;
    created_at: string;
  }[])
    .filter((r) => (r.comment ?? "").trim().length > 0)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 20);

  const base = (p.lb_areas as { name_ar: string; name_en: string } | null) ?? null;
  const rating = Number(p.rating_avg ?? 0);
  const count = Number(p.rating_count ?? 0);
  const done = Number(p.completed_count ?? 0);
  const phone = (p.phone as string | null) ?? "";
  const whatsapp = (p.whatsapp as string | null) ?? "";

  const priceText = (s: (typeof services)[number]) => {
    const key = PRICING_KEYS[s.pricing_type] ?? "priceFrom";
    const label = (t as unknown as Record<string, string>)[key] ?? "";
    return s.pricing_type === "quote" ? label : label.replace("{p}", `$${s.price ?? 0}`);
  };

  return (
    <div className="py-8 sm:py-10">
      <Container className="max-w-3xl">
        <Link
          href={`/${lang}/crafts`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          {t.title}
        </Link>

        {/* Who */}
        <div className="mt-4 flex flex-wrap items-start gap-4">
          {p.photo_url ? (
            <Image
              src={p.photo_url as string}
              alt=""
              width={88}
              height={88}
              className="h-22 w-22 shrink-0 rounded-2xl object-cover"
              sizes="88px"
            />
          ) : (
            <span className="flex h-22 w-22 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
              <Wrench className="h-9 w-9" />
            </span>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-extrabold tracking-tight">
                {p.name as string}
              </h1>
              {(p.verified as boolean) && (
                <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-bold text-success">
                  <BadgeCheck className="h-3.5 w-3.5" />
                  {t.verified}
                </span>
              )}
              {p.kind === "business" && (
                <span className="rounded-full bg-surface-muted px-2.5 py-0.5 text-xs font-bold text-muted-foreground">
                  {t.kindBusiness}
                </span>
              )}
            </div>

            {p.headline ? (
              <p className="mt-0.5 font-semibold text-muted-foreground">
                {p.headline as string}
              </p>
            ) : null}

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              {/* Never a zero: an unrated tradesman is new, not bad. */}
              {count > 0 ? (
                <span className="inline-flex items-center gap-1 font-bold text-warning">
                  <Star className="h-4 w-4 fill-current" />
                  {rating.toFixed(1)}
                  <span className="font-normal text-muted-foreground">
                    ({count})
                  </span>
                </span>
              ) : (
                <span className="text-muted-foreground">{t.noRating}</span>
              )}

              {/* Counted, never claimed — see 0241. */}
              {done > 0 && (
                <span className="inline-flex items-center gap-1 font-bold text-success">
                  <CheckCircle2 className="h-4 w-4" />
                  {t.completedCount.replace("{n}", String(done))}
                </span>
              )}

              {Number(p.years_experience ?? 0) > 0 && (
                <span className="text-muted-foreground">
                  {String(p.years_experience)} {t.years}
                </span>
              )}

              {base && (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  {ar ? base.name_ar : base.name_en}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* How to reach them — high on the page on purpose. */}
        <div className="mt-5 flex flex-wrap gap-2">
          {phone && (
            <a
              href={`tel:${phone}`}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              <Phone className="h-4 w-4" />
              {t.call}
            </a>
          )}
          {whatsapp && (
            <a
              href={waLink(whatsapp, "")}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-800"
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </a>
          )}
          <Link
            href={`/${lang}/crafts/p/${id}/request`}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-5 py-2.5 text-sm font-bold transition-colors hover:border-primary hover:text-primary"
          >
            {t.requestCta}
          </Link>
        </div>

        {trades.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-1.5">
            {trades.map((tr) => (
              <Link
                key={tr.slug}
                href={`/${lang}/crafts/${tr.slug}`}
                className="rounded-lg border border-border bg-surface px-2.5 py-1 text-sm font-semibold transition-colors hover:border-primary hover:text-primary"
              >
                <span aria-hidden className="me-1">
                  {tr.icon}
                </span>
                {ar ? tr.name_ar : tr.name_en}
              </Link>
            ))}
          </div>
        )}

        {p.bio ? (
          <p className="mt-5 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
            {p.bio as string}
          </p>
        ) : null}

        {/* Coverage — the question every other section never has to answer. */}
        {areas.length > 0 && (
          <section className="mt-8">
            <h2 className="font-extrabold">{t.coverageTitle}</h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {areas.map((a) => (
                <span
                  key={a.slug}
                  className="rounded-lg bg-surface-muted px-2.5 py-1 text-sm font-semibold text-muted-foreground"
                >
                  {ar ? a.name_ar : a.name_en}
                </span>
              ))}
            </div>
          </section>
        )}

        {services.length > 0 && (
          <section className="mt-8">
            <h2 className="font-extrabold">{t.servicesTitle}</h2>
            <div className="mt-3 divide-y divide-border rounded-2xl border border-border bg-surface">
              {services.map((s) => (
                <div
                  key={s.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 p-4"
                >
                  <div className="min-w-0">
                    <p className="font-bold">{s.name}</p>
                    {s.description && (
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {s.description}
                      </p>
                    )}
                  </div>
                  {/* A quote-only service shows the words, never a price — it
                      must not read as free. */}
                  <span className="shrink-0 font-bold text-primary">
                    {priceText(s)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {works.length > 0 && (
          <section className="mt-8">
            <h2 className="font-extrabold">{t.worksTitle}</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {works.map((w) => (
                <figure key={w.id} className="overflow-hidden rounded-xl border border-border">
                  <Image
                    src={w.image_url}
                    alt={w.title ?? ""}
                    width={300}
                    height={220}
                    className="h-36 w-full object-cover"
                    sizes="(max-width: 640px) 50vw, 240px"
                  />
                  {w.title && (
                    <figcaption className="px-3 py-2 text-xs font-semibold text-muted-foreground">
                      {w.title}
                    </figcaption>
                  )}
                </figure>
              ))}
            </div>
          </section>
        )}

        {/* What previous customers actually said. Every one of these is tied to
            a request this tradesman marked completed — there is no way to leave
            one otherwise, which is why they are worth reading. */}
        {reviews.length > 0 && (
          <section className="mt-8">
            <h2 className="font-extrabold">{t.reviewsTitle}</h2>
            <div className="mt-3 space-y-3">
              {reviews.map((r) => (
                <div
                  key={r.id}
                  className="rounded-2xl border border-border bg-surface p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold">
                      {r.customer_name?.trim() || t.reviewAnonymous}
                    </span>
                    <span className="flex items-center gap-1 text-sm font-bold text-warning">
                      <Star className="h-4 w-4 fill-current" />
                      {r.rating}
                    </span>
                  </div>
                  <p className="mt-1.5 whitespace-pre-line text-sm text-muted-foreground">
                    {r.comment}
                  </p>
                  <p className="mt-1.5 text-xs text-muted-foreground/70">
                    {new Date(r.created_at).toLocaleDateString(
                      ar ? "ar" : "en",
                      { year: "numeric", month: "short", day: "numeric" },
                    )}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Repeated at the bottom: on a phone the decision and the tap should
            not be a scroll apart. */}
        <div className="mt-10 rounded-2xl border border-border bg-surface p-5 text-center">
          <p className="font-bold">{t.readyTitle}</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {phone && (
              <a
                href={`tel:${phone}`}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
              >
                <Phone className="h-4 w-4" />
                {t.call}
              </a>
            )}
            <Link
              href={`/${lang}/crafts/p/${id}/request`}
              className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm font-bold transition-colors hover:border-primary hover:text-primary"
            >
              {t.requestCta}
            </Link>
          </div>
        </div>
      </Container>
    </div>
  );
}
