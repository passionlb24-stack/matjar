"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FileText, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { notifyError } from "@/lib/notify";

// Issuing is a deliberate act, not a page load.
//
// issue_invoice() burns a sequential number off the store's counter, and a
// sequence with gaps in it is exactly the thing a tax inspector asks about. So
// this is a button a merchant presses once, not something that happens because
// they opened a screen to look at an order.
export function IssueInvoiceButton({
  orderId,
  settingsHref,
  labels,
}: {
  orderId: string;
  settingsHref: string;
  labels: {
    issue: string;
    issuing: string;
    needsLegalName: string;
    goToSettings: string;
    error: string;
  };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  // The one failure a merchant can actually fix, so it gets a link rather than
  // a toast that disappears.
  const [needsLegal, setNeedsLegal] = useState(false);

  async function issue() {
    setBusy(true);
    const { error } = await createClient().rpc("issue_invoice", {
      p_order_id: orderId,
    });
    setBusy(false);
    if (error) {
      if ((error.message ?? "").includes("legal information is incomplete")) {
        setNeedsLegal(true);
        return;
      }
      notifyError(labels.error);
      return;
    }
    router.refresh();
  }

  if (needsLegal) {
    return (
      <div className="rounded-xl border border-warning/30 bg-warning-soft p-4 text-sm">
        <p className="font-bold text-warning">{labels.needsLegalName}</p>
        <Link
          href={settingsHref}
          className="mt-2 inline-block font-bold text-primary hover:underline"
        >
          {labels.goToSettings}
        </Link>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={issue}
      disabled={busy}
      className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-60"
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <FileText className="h-4 w-4" />
      )}
      {busy ? labels.issuing : labels.issue}
    </button>
  );
}
