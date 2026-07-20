import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Briefcase } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { JobPostForm } from "@/components/job-post-form";

export default async function NewJobPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${lang}/login`);

  // Prefill the company name from the user's store, if any.
  const { data: store } = await supabase
    .from("stores")
    .select("name")
    .eq("owner_id", user.id)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  const defaultCompany =
    (store as { name: string } | null)?.name ??
    (user.user_metadata?.full_name as string | undefined) ??
    "";

  return (
    <div className="py-10">
      <Container className="max-w-xl">
        <Link
          href={`/${lang}/jobs`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          {dict.jobs.title}
        </Link>
        <PageHeader className="mt-3" title={dict.jobs.postJob} icon={Briefcase} />
        <div className="mt-2">
          <JobPostForm lang={lang} dict={dict} defaultCompany={defaultCompany} />
        </div>
      </Container>
    </div>
  );
}
