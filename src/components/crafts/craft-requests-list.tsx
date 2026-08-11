"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Phone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { notifyError } from "@/lib/notify";

export type CraftRequestRow = {
  id: string;
  customer_name: string | null;
  phone: string;
  description: string;
  when_pref: string | null;
  status: string;
  created_at: string;
};

/**
 * What a request can become next, from where it is. Encoded rather than
 * offering every status at once: a native select over six values is how an
 * order gets cancelled by a mis-scroll, which is a bug fixed elsewhere in this
 * codebase and not worth reintroducing here.
 */
const NEXT: Record<string, ("accepted" | "in_progress" | "completed" | "declined")[]> = {
  pending: ["accepted", "declined"],
  accepted: ["in_progress", "declined"],
  in_progress: ["completed"],
};

const TONE: Record<string, string> = {
  pending: "bg-warning-soft text-warning",
  accepted: "bg-primary-soft text-primary",
  in_progress: "bg-primary-soft text-primary",
  completed: "bg-success-soft text-success",
  declined: "bg-surface-muted text-muted-foreground",
  cancelled: "bg-surface-muted text-muted-foreground",
};

export function CraftRequestsList({
  requests,
  lang,
  labels,
}: {
  requests: CraftRequestRow[];
  lang: string;
  labels: {
    accept: string;
    start: string;
    complete: string;
    decline: string;
    error: string;
    statuses: Record<string, string>;
  };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  const actionLabel: Record<string, string> = {
    accepted: labels.accept,
    in_progress: labels.start,
    completed: labels.complete,
    declined: labels.decline,
  };

  async function move(id: string, status: string) {
    setBusy(id);
    const { error } = await createClient()
      .from("craft_requests")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);
    setBusy(null);
    if (error) {
      notifyError(labels.error);
      return;
    }
    // Completing is what increments the public jobs counter (0241), so the
    // page has to re-read rather than patch state locally.
    router.refresh();
  }

  return (
    <ul className="space-y-3">
      {requests.map((r) => (
        <li key={r.id} className="rounded-2xl border border-border bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-bold">
              {r.customer_name || "—"}
              <a
                href={`tel:${r.phone}`}
                dir="ltr"
                className="ms-2 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
              >
                <Phone className="h-3.5 w-3.5" />
                {r.phone}
              </a>
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                TONE[r.status] ?? "bg-surface-muted text-muted-foreground"
              }`}
            >
              {labels.statuses[r.status] ?? r.status}
            </span>
          </div>

          <p className="mt-2 whitespace-pre-line text-sm">{r.description}</p>

          <p className="mt-1.5 text-xs text-muted-foreground">
            {new Date(r.created_at).toLocaleDateString(
              lang === "ar" ? "ar" : "en",
              { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" },
            )}
            {r.when_pref && ` · ${r.when_pref}`}
          </p>

          {(NEXT[r.status] ?? []).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {NEXT[r.status].map((next) => (
                <button
                  key={next}
                  type="button"
                  disabled={busy === r.id}
                  onClick={() => move(r.id, next)}
                  className={`rounded-lg px-3.5 py-1.5 text-sm font-bold transition-colors disabled:opacity-60 ${
                    next === "declined"
                      ? "border border-border text-muted-foreground hover:border-danger hover:text-danger"
                      : "bg-primary text-primary-foreground hover:bg-primary-hover"
                  }`}
                >
                  {actionLabel[next]}
                </button>
              ))}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
