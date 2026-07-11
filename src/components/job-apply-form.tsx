"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";

const field =
  "mt-1.5 w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15 placeholder:text-muted-foreground";

export function JobApplyForm({
  jobId,
  lang,
  dict,
  applied,
}: {
  jobId: string;
  lang: Locale;
  dict: Dictionary;
  applied: boolean;
}) {
  const router = useRouter();
  const t = dict.jobs;
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(applied);
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
    const { error: insErr } = await supabase.from("job_applications").insert({
      job_id: jobId,
      applicant_id: user.id,
      cover_note: String(form.get("cover_note")) || null,
      phone: String(form.get("phone")) || null,
      cv_url: String(form.get("cv_url")) || null,
    });
    setLoading(false);
    if (insErr) {
      setError(dict.auth.errorGeneric);
      return;
    }
    setDone(true);
    router.refresh();
  }

  if (done) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 font-bold text-emerald-700">
        <Check className="h-5 w-5" />
        {t.applied}
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 rounded-2xl border border-border bg-surface p-5"
    >
      <h2 className="font-bold">{t.applyTitle}</h2>
      <div>
        <input name="phone" type="tel" inputMode="tel" placeholder={t.applyPhone} className={field} />
      </div>
      <div>
        <input name="cv_url" type="url" placeholder={t.applyCv} className={field} dir="ltr" />
      </div>
      <div>
        <textarea name="cover_note" rows={3} placeholder={t.applyNote} className={field} />
      </div>
      {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-60"
      >
        {loading ? dict.account.saving : t.apply}
      </button>
    </form>
  );
}
