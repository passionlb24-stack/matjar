"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Flag, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";

const REASONS = ["violating", "duplicate", "misleading", "images", "fraud"] as const;

export function ListingReport({
  listingId,
  lang,
  dict,
}: {
  listingId: string;
  lang: Locale;
  dict: Dictionary;
}) {
  const router = useRouter();
  const t = dict.market;
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function report(reason: string) {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setBusy(false);
      router.push(`/${lang}/login`);
      return;
    }
    const { error: e } = await supabase
      .from("listing_reports")
      .insert({ listing_id: listingId, reporter_id: user.id, reason });
    setBusy(false);
    // 23505 = duplicate → the user already reported this listing; treat as done.
    if (e && e.code !== "23505") {
      setError(dict.auth.errorGeneric);
      return;
    }
    setOpen(false);
    setSent(true);
  }

  if (sent) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
        <Check className="h-4 w-4" />
        {t.reportSent}
      </span>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-danger"
      >
        <Flag className="h-4 w-4" />
        {t.report}
      </button>
      {open && (
        <div className="absolute end-0 z-20 mt-2 w-56 rounded-xl border border-border bg-surface p-2 shadow-lg">
          <p className="px-2 py-1 text-xs font-bold text-muted-foreground">
            {t.reportTitle}
          </p>
          {REASONS.map((r) => (
            <button
              key={r}
              disabled={busy}
              onClick={() => report(r)}
              className="block w-full rounded-lg px-2 py-1.5 text-start text-sm transition-colors hover:bg-surface-muted disabled:opacity-60"
            >
              {t.reasons[r]}
            </button>
          ))}
          {error && (
            <p className="px-2 py-1 text-xs font-medium text-danger">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}
