"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

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
    <Button
      size="sm"
      variant="secondary"
      onClick={remove}
      disabled={busy}
      leftIcon={<Trash2 className="h-4 w-4" />}
      className="shrink-0 !text-danger"
    >
      {label}
    </Button>
  );
}
