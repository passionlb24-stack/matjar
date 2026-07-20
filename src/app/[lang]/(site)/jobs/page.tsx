import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Briefcase, MapPin, Plus } from "lucide-react";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { localeAlternates } from "@/lib/site";
import { regions } from "@/lib/catalog";
import { JOB_TYPES, type JobPosting } from "@/lib/jobs";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    title: dict.jobs.title,
    description: dict.jobs.subtitle,
    alternates: localeAlternates(lang, "/jobs"),
  };
}

function timeAgo(iso: string, lang: Locale) {
  return new Date(iso).toLocaleDateString(lang === "ar" ? "ar" : "en", {
    month: "short",
    day: "numeric",
  });
}

export default async function JobsPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ region?: string; type?: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const { region, type } = await searchParams;
  const dict = await getDictionary(lang);
  const t = dict.jobs;

  const supabase = await createClient();
  let q = supabase
    .from("job_postings")
    .select("id, title, company_name, region, job_type, salary_note, created_at")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(100);
  if (region) q = q.eq("region", region);
  if (type) q = q.eq("job_type", type);
  const { data } = await q;
  const jobs = (data ?? []) as JobPosting[];

  const chip = (active: boolean) =>
    `rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
      active
        ? "border-primary bg-primary-soft text-primary"
        : "border-border text-muted-foreground hover:border-primary/40"
    }`;
  const qs = (o: { region?: string; type?: string }) => {
    const p = new URLSearchParams();
    const r = o.region ?? region;
    const ty = o.type ?? type;
    if (r) p.set("region", r);
    if (ty) p.set("type", ty);
    const s = p.toString();
    return `/${lang}/jobs${s ? `?${s}` : ""}`;
  };

  return (
    <div className="py-10">
      <Container>
        <PageHeader
          title={t.title}
          subtitle={t.subtitle}
          icon={Briefcase}
          actions={
            <ButtonLink
              href={`/${lang}/jobs/new`}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              {t.postJob}
            </ButtonLink>
          }
        />

        {/* Type filter */}
        <div className="mt-2 flex flex-wrap gap-2">
          <Link href={qs({ type: "" })} className={chip(!type)}>
            {t.allTypes}
          </Link>
          {JOB_TYPES.map((ty) => (
            <Link key={ty} href={qs({ type: ty })} className={chip(type === ty)}>
              {t.types[ty]}
            </Link>
          ))}
        </div>
        {/* Region filter */}
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href={qs({ region: "" })} className={chip(!region)}>
            {t.allRegions}
          </Link>
          {regions.map((r) => (
            <Link
              key={r.key}
              href={qs({ region: r.key })}
              className={chip(region === r.key)}
            >
              {r.name[lang]}
            </Link>
          ))}
        </div>

        {jobs.length ? (
          <div data-animate className="mt-8 grid gap-4 sm:grid-cols-2">
            {jobs.map((j) => {
              const regionName =
                regions.find((r) => r.key === j.region)?.name[lang] ?? j.region;
              return (
                <Card
                  key={j.id}
                  variant="interactive"
                  className="group relative p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="font-bold leading-tight transition-colors group-hover:text-primary">
                        {j.title}
                      </h2>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {j.company_name}
                      </p>
                    </div>
                    {j.job_type && (
                      <Badge variant="primary" size="sm" className="shrink-0">
                        {t.types[j.job_type as keyof typeof t.types] ?? j.job_type}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                    {regionName && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {regionName}
                      </span>
                    )}
                    {j.salary_note && (
                      <span className="font-semibold text-primary">
                        {j.salary_note}
                      </span>
                    )}
                    <span>{timeAgo(j.created_at, lang as Locale)}</span>
                  </div>
                  <Link
                    href={`/${lang}/jobs/${j.id}`}
                    aria-label={j.title}
                    className="absolute inset-0"
                  />
                </Card>
              );
            })}
          </div>
        ) : (
          <EmptyState
            className="mt-8"
            icon={Briefcase}
            title={t.empty}
            action={{ href: `/${lang}/jobs/new`, label: t.postJob }}
          />
        )}
      </Container>
    </div>
  );
}
