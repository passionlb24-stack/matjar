import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Briefcase, MapPin, ChevronRight, Phone, FileText } from "lucide-react";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { localeAlternates } from "@/lib/site";
import { regions } from "@/lib/catalog";
import type { JobPosting } from "@/lib/jobs";
import { Container } from "@/components/ui/container";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { JobApplyForm } from "@/components/job-apply-form";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}): Promise<Metadata> {
  const { lang, id } = await params;
  if (!isLocale(lang) || !UUID_RE.test(id)) return {};
  const supabase = await createClient();
  const { data } = await supabase
    .from("job_postings")
    .select("title, company_name, description")
    .eq("id", id)
    .maybeSingle();
  if (!data) return {};
  const j = data as { title: string; company_name: string; description: string };
  return {
    title: `${j.title} — ${j.company_name}`,
    description: j.description.slice(0, 160),
    alternates: localeAlternates(lang, `/jobs/${id}`),
  };
}

type Applicant = {
  id: string;
  cover_note: string | null;
  phone: string | null;
  cv_url: string | null;
  profiles: { full_name: string | null } | null;
};

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  if (!isLocale(lang)) notFound();
  if (!UUID_RE.test(id)) notFound();
  const dict = await getDictionary(lang);
  const t = dict.jobs;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data } = await supabase
    .from("job_postings")
    .select(
      "id, poster_id, title, company_name, description, region, job_type, salary_note, how_to_apply, status, created_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const job = data as JobPosting;
  const isPoster = user?.id === job.poster_id;

  // Applicants (poster only) or my-application state.
  let applicants: Applicant[] = [];
  let alreadyApplied = false;
  if (isPoster) {
    const { data: apps } = await supabase
      .from("job_applications")
      .select("id, cover_note, phone, cv_url, profiles(full_name)")
      .eq("job_id", id)
      .order("created_at", { ascending: false });
    applicants = (apps ?? []) as unknown as Applicant[];
  } else if (user) {
    const { data: mine } = await supabase
      .from("job_applications")
      .select("id")
      .eq("job_id", id)
      .eq("applicant_id", user.id)
      .maybeSingle();
    alreadyApplied = !!mine;
  }

  const regionName =
    regions.find((r) => r.key === job.region)?.name[lang] ?? job.region;

  return (
    <div className="py-10">
      <Container className="max-w-2xl">
        <Link
          href={`/${lang}/jobs`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          {t.title}
        </Link>

        <Card className="mt-4 p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight">
                {job.title}
              </h1>
              <p className="mt-1 font-semibold text-muted-foreground">
                {job.company_name}
              </p>
            </div>
            {job.job_type && (
              <Badge variant="primary" className="shrink-0">
                {t.types[job.job_type as keyof typeof t.types] ?? job.job_type}
              </Badge>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {regionName && (
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {regionName}
              </span>
            )}
            {job.salary_note && (
              <span className="font-semibold text-primary">{job.salary_note}</span>
            )}
          </div>
          <p className="mt-4 whitespace-pre-wrap border-t border-border pt-4 text-muted-foreground">
            {job.description}
          </p>
          {job.how_to_apply && (
            <p className="mt-3 text-sm">
              <span className="font-bold">{t.howToApply}:</span> {job.how_to_apply}
            </p>
          )}
        </Card>

        {/* Poster sees applicants; others see the apply form */}
        {isPoster ? (
          <div className="mt-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
              <Briefcase className="h-5 w-5 text-primary" />
              {t.applicants} ({applicants.length})
            </h2>
            {applicants.length ? (
              <div className="space-y-3">
                {applicants.map((a) => (
                  <Card key={a.id} className="p-4">
                    <p className="font-bold">
                      {a.profiles?.full_name ?? t.applicant}
                    </p>
                    {a.cover_note && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {a.cover_note}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-3 text-sm">
                      {a.phone && (
                        <a
                          href={`tel:${a.phone}`}
                          className="flex items-center gap-1 font-semibold text-primary"
                          dir="ltr"
                        >
                          <Phone className="h-4 w-4" />
                          {a.phone}
                        </a>
                      )}
                      {a.cv_url && (
                        <a
                          href={a.cv_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 font-semibold text-primary"
                        >
                          <FileText className="h-4 w-4" />
                          {t.viewCv}
                        </a>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <EmptyState icon={Briefcase} title={t.noApplicants} />
            )}
          </div>
        ) : (
          <div className="mt-6">
            <JobApplyForm
              jobId={job.id}
              lang={lang as Locale}
              dict={dict}
              applied={alreadyApplied}
            />
          </div>
        )}
      </Container>
    </div>
  );
}
