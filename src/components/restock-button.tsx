"use client";

import { useState } from "react";
import Link from "next/link";
import { BellRing, BellOff, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { notifyError, notifySuccess } from "@/lib/notify";
import type { Locale } from "@/i18n/config";

// "Notify me when available" on a sold-out product. Login-required (an in-app
// notification is the delivery channel). Joining goes through the
// join_stock_waitlist RPC (resolves store + guards state); leaving is a direct
// RLS-scoped delete of the caller's own row.
export function RestockButton({
  productId,
  lang,
  loggedIn,
  subscribed,
  labels,
}: {
  productId: string;
  lang: Locale;
  loggedIn: boolean;
  subscribed: boolean;
  labels: {
    notify: string;
    login: string;
    on: string;
    cancel: string;
    saved: string;
    error: string;
  };
}) {
  const [on, setOn] = useState(subscribed);
  const [busy, setBusy] = useState(false);

  if (!loggedIn) {
    return (
      <Link
        href={`/${lang}/login`}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-border px-6 py-3 font-bold transition-colors hover:border-primary hover:text-primary"
      >
        <BellRing className="h-4 w-4" />
        {labels.login}
      </Link>
    );
  }

  async function join() {
    if (busy) return;
    setBusy(true);
    const { data, error } = await createClient().rpc("join_stock_waitlist", {
      p_product_id: productId,
    });
    setBusy(false);
    if (error || data !== "ok") {
      notifyError(labels.error);
      return;
    }
    setOn(true);
    notifySuccess(labels.saved);
  }

  async function leave() {
    if (busy) return;
    setBusy(true);
    // RLS (stock_waitlist_delete_own) limits this to the caller's own row.
    const { error } = await createClient()
      .from("stock_waitlist")
      .delete()
      .eq("product_id", productId);
    setBusy(false);
    if (error) {
      notifyError(labels.error);
      return;
    }
    setOn(false);
  }

  if (on) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-xl bg-primary-soft px-4 py-3 text-sm font-bold text-primary">
          <Check className="h-4 w-4" />
          {labels.on}
        </span>
        <button
          type="button"
          onClick={leave}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-xl px-3 py-3 text-sm font-semibold text-muted-foreground transition-colors hover:text-danger disabled:opacity-60"
        >
          <BellOff className="h-4 w-4" />
          {labels.cancel}
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={join}
      disabled={busy}
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary bg-primary-soft px-6 py-3 font-bold text-primary transition-colors hover:bg-primary hover:text-primary-foreground disabled:opacity-60"
    >
      <BellRing className="h-4 w-4" />
      {labels.notify}
    </button>
  );
}
