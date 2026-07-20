"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Phone, Send } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/client";
import { notifyError } from "@/lib/notify";

export type ServiceRequestRow = {
  id: string;
  status:
    | "pending"
    | "quoted"
    | "accepted"
    | "in_progress"
    | "completed"
    | "declined"
    | "cancelled";
  description: string;
  address: string | null;
  phone: string | null;
  customer_name: string | null;
  quote_amount: number | null;
  quote_note: string | null;
  created_at: string;
};

function money(n: number) {
  return n >= 1000 ? `$${Number(n).toLocaleString("en-US")}` : `$${n}`;
}

const STATUS_TONE: Record<ServiceRequestRow["status"], string> = {
  pending: "bg-warning-soft text-warning",
  quoted: "bg-info-soft text-info",
  accepted: "bg-success-soft text-success",
  in_progress: "bg-primary-soft text-primary",
  completed: "bg-success-soft text-success",
  declined: "bg-danger-soft text-danger",
  cancelled: "bg-surface-muted text-muted-foreground",
};

// Provider-side controls for one service request: send a quote, then drive the
// job (decline / start / complete). All transitions go through the RPC.
export function ServiceRequestManager({
  request,
  lang,
  dict,
}: {
  request: ServiceRequestRow;
  lang: Locale;
  dict: Dictionary;
}) {
  const router = useRouter();
  const t = dict.os.requests;
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function act(action: string, extra?: { amount?: number; note?: string }) {
    if (busy) return;
    if (action === "decline" && !window.confirm(t.confirmDecline)) return;
    setBusy(true);
    const { error } = await createClient().rpc("manage_service_request", {
      p_id: request.id,
      p_action: action,
      p_amount: extra?.amount ?? null,
      p_note: extra?.note ?? null,
    });
    setBusy(false);
    if (error) {
      notifyError(dict.common.actionFailed);
      return;
    }
    router.refresh();
  }

  async function sendQuote() {
    const amt = Number(amount);
    if (!amt || amt <= 0) return;
    await act("quote", { amount: amt, note: note.trim() || undefined });
  }

  const created = new Date(request.created_at).toLocaleDateString(
    lang === "ar" ? "ar" : "en",
    { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" },
  );

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-muted-foreground">
          {request.customer_name && (
            <span className="font-bold text-foreground">
              {request.customer_name}
            </span>
          )}
          <span className="ms-2 text-xs">{created}</span>
        </span>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_TONE[request.status]}`}
        >
          {t.status[request.status]}
        </span>
      </div>

      <p className="mt-3 border-t border-border pt-3 text-sm">
        {request.description}
      </p>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {request.phone && (
          <a
            href={`tel:${request.phone}`}
            className="flex items-center gap-1 hover:text-foreground"
          >
            <Phone className="h-3.5 w-3.5" />
            {request.phone}
          </a>
        )}
        {request.address && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {request.address}
          </span>
        )}
      </div>

      {request.quote_amount != null && (
        <p className="mt-3 rounded-xl bg-info-soft px-3 py-2 text-sm">
          <span className="font-bold text-info">
            {t.quotedAt}: {money(Number(request.quote_amount))}
          </span>
          {request.quote_note && (
            <span className="text-muted-foreground"> · {request.quote_note}</span>
          )}
        </p>
      )}

      {/* Provider actions by state. */}
      {request.status === "pending" && (
        <div className="mt-3 grid gap-2 rounded-xl border border-border bg-surface-muted/40 p-3 sm:grid-cols-[1fr_2fr_auto]">
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={t.quoteAmount}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t.quoteNote}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <button
            onClick={sendQuote}
            disabled={busy}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
            {t.sendQuote}
          </button>
        </div>
      )}

      {(request.status === "pending" ||
        request.status === "quoted" ||
        request.status === "accepted" ||
        request.status === "in_progress") && (
        <div className="mt-3 flex flex-wrap gap-2">
          {request.status === "accepted" && (
            <button
              onClick={() => act("start")}
              disabled={busy}
              className="rounded-lg border border-border px-3 py-1.5 text-sm font-bold transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
            >
              {t.start}
            </button>
          )}
          {(request.status === "accepted" ||
            request.status === "in_progress") && (
            <button
              onClick={() => act("complete")}
              disabled={busy}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
            >
              {t.complete}
            </button>
          )}
          <button
            onClick={() => act("decline")}
            disabled={busy}
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-danger transition-colors hover:bg-danger-soft disabled:opacity-60"
          >
            {t.decline}
          </button>
        </div>
      )}
    </div>
  );
}
