"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function AdminReviewDelete({
  reviewId,
  label,
  confirmLabel,
  errorLabel,
}: {
  reviewId: string;
  label: string;
  confirmLabel: string;
  errorLabel: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!window.confirm(confirmLabel)) return;
    setBusy(true);
    const { error } = await createClient()
      .from("reviews")
      .delete()
      .eq("id", reviewId);
    setBusy(false);
    if (error) {
      window.alert(errorLabel);
      return;
    }
    router.refresh();
  }

  return (
    <button
      onClick={remove}
      disabled={busy}
      className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60"
    >
      <Trash2 className="h-4 w-4" />
      {label}
    </button>
  );
}
