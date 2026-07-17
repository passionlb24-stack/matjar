"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { notifyError } from "@/lib/notify";
import { revalidateRate } from "@/lib/cache-actions";
import type { Dictionary } from "@/i18n/get-dictionary";

export function AdminSettingsForm({
  dict,
  initialRate,
}: {
  dict: Dictionary;
  initialRate: string;
}) {
  const router = useRouter();
  const t = dict.admin.platform;
  const [rate, setRate] = useState(initialRate);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setSaved(false);
    const { error } = await createClient().from("app_settings").upsert(
      {
        key: "usd_lbp_rate",
        value: String(Number(rate) || 0),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );
    setLoading(false);
    if (error) {
      notifyError(dict.common.actionFailed);
      return;
    }
    await revalidateRate();
    setSaved(true);
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="max-w-md space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-sm"
    >
      <div>
        <label className="text-sm font-semibold" htmlFor="rate">
          {t.lbpRate}
        </label>
        <input
          id="rate"
          type="number"
          min="0"
          step="100"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
        />
        <p className="mt-1 text-xs text-muted-foreground">{t.lbpRateHint}</p>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-60"
        >
          {loading ? t.saving : t.save}
        </button>
        {saved && (
          <span className="text-sm font-semibold text-primary">{t.saved}</span>
        )}
      </div>
    </form>
  );
}
