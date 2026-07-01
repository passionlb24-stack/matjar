"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ExternalLink, Flag } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/client";
import { Container } from "@/components/ui/container";

export type AdminReport = {
  id: string;
  listingId: string;
  listingTitle: string;
  reason: string;
  status: "open" | "reviewed";
  createdAt: string;
};

export function AdminMarketReportsClient({
  lang,
  dict,
  reports,
}: {
  lang: Locale;
  dict: Dictionary;
  reports: AdminReport[];
}) {
  const router = useRouter();
  const t = dict.admin.market;
  const reasons = dict.market.reasons as Record<string, string>;
  const [busyId, setBusyId] = useState<string | null>(null);

  async function markReviewed(id: string) {
    setBusyId(id);
    await createClient()
      .from("listing_reports")
      .update({ status: "reviewed" })
      .eq("id", id);
    setBusyId(null);
    router.refresh();
  }

  return (
    <div className="py-10">
      <Container>
        <div className="flex items-center gap-2">
          <Flag className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-extrabold tracking-tight">
            {t.reportsTitle}
          </h1>
        </div>
        <p className="mt-2 text-muted-foreground">{t.reportsSubtitle}</p>

        <div className="mt-6 space-y-2">
          {reports.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border py-16 text-center text-muted-foreground">
              {t.noReports}
            </div>
          )}
          {reports.map((r) => (
            <div
              key={r.id}
              className={`flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-4 ${
                r.status === "open"
                  ? "border-amber-300 bg-amber-50/50"
                  : "border-border bg-surface"
              }`}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold">{r.listingTitle}</span>
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                    {reasons[r.reason] ?? r.reason}
                  </span>
                  {r.status === "reviewed" && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
                      ✓
                    </span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Link
                  href={`/${lang}/market/${r.listingId}`}
                  target="_blank"
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-semibold transition-colors hover:bg-surface-muted"
                >
                  <ExternalLink className="h-4 w-4" />
                  {t.viewListing}
                </Link>
                {r.status === "open" && (
                  <button
                    disabled={busyId === r.id}
                    onClick={() => markReviewed(r.id)}
                    className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-60"
                  >
                    <Check className="h-4 w-4" />
                    {t.markReviewed}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Container>
    </div>
  );
}
