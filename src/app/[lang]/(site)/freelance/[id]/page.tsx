import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ChevronRight, Clock, MapPin, User } from "lucide-react";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { localeAlternates } from "@/lib/site";
import { regions } from "@/lib/catalog";
import type { Gig } from "@/lib/gigs";
import { Container } from "@/components/ui/container";
import { ContactFreelancerButton } from "@/components/contact-freelancer-button";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function money(n: number) {
  return n >= 1000 ? `$${Number(n).toLocaleString("en-US")}` : `$${n}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}): Promise<Metadata> {
  const { lang, id } = await params;
  if (!isLocale(lang) || !UUID_RE.test(id)) return {};
  const supabase = await createClient();
  const { data } = await supabase
    .from("gigs")
    .select("title, description, image_url")
    .eq("id", id)
    .maybeSingle();
  if (!data) return {};
  const g = data as { title: string; description: string; image_url: string | null };
  return {
    title: g.title,
    description: g.description.slice(0, 160),
    alternates: localeAlternates(lang, `/freelance/${id}`),
    openGraph: { images: g.image_url ? [g.image_url] : undefined },
  };
}

export default async function GigDetailPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  if (!isLocale(lang)) notFound();
  if (!UUID_RE.test(id)) notFound();
  const dict = await getDictionary(lang);
  const t = dict.freelance;

  const supabase = await createClient();
  const { data } = await supabase
    .from("gigs")
    .select(
      "id, freelancer_id, freelancer_name, title, description, category, price, delivery_days, image_url, region",
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const gig = data as Gig;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isOwn = user?.id === gig.freelancer_id;
  const regionName =
    regions.find((r) => r.key === gig.region)?.name[lang] ?? gig.region;

  return (
    <div className="py-10">
      <Container className="max-w-2xl">
        <Link
          href={`/${lang}/freelance`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          {t.title}
        </Link>

        {gig.image_url && (
          <Image
            src={gig.image_url}
            alt={gig.title}
            width={800}
            height={450}
            className="mt-4 aspect-video w-full rounded-2xl object-cover"
            sizes="(max-width: 768px) 100vw, 672px"
          />
        )}

        <div className="mt-4 rounded-2xl border border-border bg-surface p-6">
          {gig.category && (
            <span className="text-sm font-semibold text-muted-foreground">
              {t.categories[gig.category as keyof typeof t.categories] ??
                gig.category}
            </span>
          )}
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight">
            {gig.title}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <User className="h-4 w-4" />
              {gig.freelancer_name || t.freelancer}
            </span>
            {regionName && (
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {regionName}
              </span>
            )}
            {gig.delivery_days != null && (
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {t.deliveryIn.replace("{n}", String(gig.delivery_days))}
              </span>
            )}
          </div>
          <p className="mt-4 whitespace-pre-wrap border-t border-border pt-4 text-muted-foreground">
            {gig.description}
          </p>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
            {gig.price != null && (
              <div>
                <span className="text-xs text-muted-foreground">{t.from}</span>
                <p className="text-2xl font-extrabold text-primary">
                  {money(Number(gig.price))}
                </p>
              </div>
            )}
            {!isOwn && (
              <ContactFreelancerButton
                freelancerId={gig.freelancer_id}
                lang={lang as Locale}
                dict={dict}
              />
            )}
          </div>
        </div>
      </Container>
    </div>
  );
}
