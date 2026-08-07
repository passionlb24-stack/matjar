"use client";
import { notifyError } from "@/lib/notify";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { logAdminAction } from "@/lib/audit";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";

export function AdminReviewDelete({
  reviewId,
  label,
  confirmLabel,

  errorLabel,
  okLabel,
  cancelLabel,
}: {
  reviewId: string;
  label: string;
  confirmLabel: string;
  errorLabel: string;
  /**
   * Button labels for the confirm dialog. These were the Arabic literals
   * "تأكيد" / "إلغاء", so an English admin was asked to approve an
   * irreversible action with two buttons they could not read.
   */
  okLabel: string;
  cancelLabel: string;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (
      !(await confirm({
        message: confirmLabel,
        confirmLabel: okLabel,
        cancelLabel: cancelLabel,
        danger: true,
      }))
    )
      return;
    setBusy(true);
    const { error } = await createClient()
      .from("reviews")
      .delete()
      .eq("id", reviewId);
    setBusy(false);
    if (error) {
      notifyError(errorLabel);
      return;
    }
    void logAdminAction("deleted", "review", reviewId);
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
