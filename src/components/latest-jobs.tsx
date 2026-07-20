import Link from "next/link";
import { Briefcase, MapPin, ChevronLeft } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { regions } from "@/lib/catalog";
import { getLatestJobs } from "@/lib/data/home";
import { Container } from "@/components/ui/container";

// Homepage teaser for the jobs vertical — the newest active postings. Streams
// in its own <Suspense>; renders nothing when there are no jobs yet.
export async function LatestJobs({
  lang,
  dict,
}: {
  lang: Locale;
  dict: Dictionary;
}) {
  const jobs = await getLatestJobs(4);
  if (!jobs.length) return null;
  const t = dict.home2;

  return (
    <section className="py-8 sm:py-12">
      <Container>
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              {t.jobsTitle}
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground sm:text-base">
              {t.jobsSubtitle}
            </p>
          </div>
          <Link
            href={`/${lang}/jobs`}
            className="inline-flex shrink-0 items-center gap-1 text-sm font-bold text-primary transition-colors hover:text-primary-hover"
          >
            {t.seeAll}
            <ChevronLeft className="h-4 w-4 ltr:rotate-180" />
          </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {jobs.map((j) => {
            const regionName =
              regions.find((r) => r.key === j.region)?.name[lang] ?? j.region;
            return (
              <Link
                key={j.id}
                href={`/${lang}/jobs/${j.id}`}
                className="group flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <Briefcase className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-bold transition-colors group-hover:text-primary">
                    {j.title}
                  </h3>
                  <p className="mt-0.5 flex items-center gap-2 truncate text-xs text-muted-foreground">
                    <span className="truncate">{j.company_name}</span>
                    {regionName && (
                      <span className="flex shrink-0 items-center gap-0.5">
                        <MapPin className="h-3 w-3" />
                        {regionName}
                      </span>
                    )}
                  </p>
                </div>
                {j.salary_note && (
                  <span className="shrink-0 text-sm font-extrabold text-success">
                    {j.salary_note}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
