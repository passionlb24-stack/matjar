import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronRight, Plus, Users, Briefcase } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/container";
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
        <div className="mt-3 flex items-center justify-between gap-3">
          <h1 className="text-3xl font-extrabold tracking-tight">
            {t.myPostings}
          </h1>
          <Link
            href={`/${lang}/jobs/new`}
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            <Plus className="h-4 w-4" />
            {t.postJob}
          </Link>
        </div>

        {jobs.length ? (
          <div className="mt-8 space-y-3">
            {jobs.map((j) => (
              <Link
                key={j.id}
                href={`/${lang}/jobs/${j.id}`}
                className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-primary"
              >
                <div>
                  <p className="font-bold">{j.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {j.status === "active" ? t.statusActive : t.statusClosed}
                  </p>
                </div>
                <span className="flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-sm font-bold text-primary">
                  <Users className="h-4 w-4" />
                  {j.job_applications?.[0]?.count ?? 0}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState className="mt-8" icon={Briefcase} title={t.noPostings} />
        )}
      </Container>
    </div>
  );
}
