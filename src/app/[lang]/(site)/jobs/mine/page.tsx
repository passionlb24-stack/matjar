import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronRight, Plus, Users, Briefcase } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export default async function MyJobsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const t = dict.jobs;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${lang}/login`);

  const { data } = await supabase
    .from("job_postings")
    .select("id, title, status, created_at, job_applications(count)")
    .eq("poster_id", user.id)
    .order("created_at", { ascending: false });
  const jobs = (data ?? []) as unknown as {
    id: string;
    title: string;
    status: string;
    job_applications: { count: number }[];
  }[];

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
        <PageHeader
          className="mt-3"
          title={t.myPostings}
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

        {jobs.length ? (
          <div data-animate className="mt-6 space-y-3">
            {jobs.map((j) => (
              <Card
                key={j.id}
                variant="interactive"
                className="relative flex items-center justify-between gap-4 p-5"
              >
                <div>
                  <p className="font-bold">{j.title}</p>
                  <p className="mt-0.5">
                    <Badge
                      variant={j.status === "active" ? "success" : "neutral"}
                      size="sm"
                    >
                      {j.status === "active" ? t.statusActive : t.statusClosed}
                    </Badge>
                  </p>
                </div>
                <Badge variant="primary">
                  <Users className="h-4 w-4" />
                  {j.job_applications?.[0]?.count ?? 0}
                </Badge>
                <Link
                  href={`/${lang}/jobs/${j.id}`}
                  aria-label={j.title}
                  className="absolute inset-0"
                />
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState className="mt-8" icon={Briefcase} title={t.noPostings} />
        )}
      </Container>
    </div>
  );
}
