"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { regions } from "@/lib/catalog";
import { JOB_TYPES } from "@/lib/jobs";

const field =
  "mt-1.5 w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15 placeholder:text-muted-foreground";
const label = "text-sm font-semibold";

export function JobPostForm({
  lang,
  dict,
  defaultCompany,
}: {
  lang: Locale;
  dict: Dictionary;
  defaultCompany: string;
}) {
  const router = useRouter();
  const t = dict.jobs;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push(`/${lang}/login`);
      return;
    }
    const { data, error: insErr } = await supabase
      .from("job_postings")
      .insert({
        poster_id: user.id,
        title: String(form.get("title")),
        company_name: String(form.get("company_name")),
        description: String(form.get("description")),
        region: String(form.get("region")) || null,
        job_type: String(form.get("job_type")) || null,
        salary_note: String(form.get("salary_note")) || null,
        how_to_apply: String(form.get("how_to_apply")) || null,
      })
      .select("id")
      .single();
    if (insErr || !data) {
      setError(dict.auth.errorGeneric);
      setLoading(false);
      return;
    }
    router.push(`/${lang}/jobs/${data.id}`);
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-sm"
    >
      <div>
        <label className={label} htmlFor="title">{t.jobTitle}</label>
        <input id="title" name="title" type="text" required placeholder={t.jobTitlePlaceholder} className={field} />
      </div>
      <div>
        <label className={label} htmlFor="company_name">{t.company}</label>
        <input id="company_name" name="company_name" type="text" required defaultValue={defaultCompany} className={field} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="region">{t.region}</label>
          <select id="region" name="region" defaultValue="" className={field}>
            <option value="">{t.selectRegion}</option>
            {regions.map((r) => (
              <option key={r.key} value={r.key}>{r.name[lang]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="job_type">{t.type}</label>
          <select id="job_type" name="job_type" defaultValue="" className={field}>
            <option value="">{t.selectType}</option>
            {JOB_TYPES.map((ty) => (
              <option key={ty} value={ty}>{t.types[ty]}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className={label} htmlFor="salary_note">{t.salary}</label>
        <input id="salary_note" name="salary_note" type="text" placeholder={t.salaryPlaceholder} className={field} />
      </div>
      <div>
        <label className={label} htmlFor="description">{t.description}</label>
        <textarea id="description" name="description" rows={5} required placeholder={t.descriptionPlaceholder} className={field} />
      </div>
      <div>
        <label className={label} htmlFor="how_to_apply">{t.howToApply}</label>
        <input id="how_to_apply" name="how_to_apply" type="text" placeholder={t.howToApplyPlaceholder} className={field} />
      </div>

      {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-60"
      >
        {loading ? dict.account.saving : t.publish}
      </button>
    </form>
  );
}
