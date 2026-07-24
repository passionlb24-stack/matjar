import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { requireAdminSection } from "@/lib/admin-guard";
import {
  AdminModerationClient,
  type ModerationItem,
} from "@/components/admin-moderation-client";

export default async function AdminJobsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  await requireAdminSection("jobs", lang);
  const dict = await getDictionary(lang);

  const supabase = await createClient();
  const { data } = await supabase
    .from("job_postings")
    .select(
      "id, title, company_name, region, job_type, status, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(500);

  const rows = (data ?? []) as unknown as {
    id: string;
    title: string;
    company_name: string | null;
    region: string | null;
    job_type: string | null;
    status: string;
    created_at: string;
  }[];

  const items: ModerationItem[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    author: r.company_name,
    meta: [r.job_type, r.region].filter(Boolean).join(" · ") || null,
    image: null,
    status: r.status,
    createdAt: r.created_at,
  }));

  return (
    <AdminModerationClient
      lang={lang}
      dict={dict}
      table="job_postings"
      title={dict.admin.jobs.title}
      subtitle={dict.admin.jobs.subtitle}
      viewBase="jobs"
      items={items}
    />
  );
}
